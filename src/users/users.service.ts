import { Injectable, ConflictException, NotFoundException, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Runs once after the app fully starts. Admin identity comes entirely from
   * ADMIN_EMAIL / ADMIN_PASSWORD env vars — nothing is hardcoded. If either is
   * unset, no admin account is created or modified. If the account already
   * exists and ADMIN_PASSWORD no longer matches its stored hash, the hash is
   * rotated to match — so rotating the admin password in production is just
   * changing the env var and redeploying, no manual DB access required.
   */
  async onApplicationBootstrap() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      this.logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin account bootstrap');
      return;
    }

    const existing = await this.userRepo.findOne({ where: { email: adminEmail } });
    if (!existing) {
      const admin = this.userRepo.create({
        email: adminEmail,
        name: 'Admin',
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'admin',
        plan: 'enterprise',
        gpuQuotaHours: 1000,
        usedGpuHours: 0,
      });
      await this.userRepo.save(admin);
      this.logger.log(`Admin account seeded: ${adminEmail}`);
      return;
    }

    const updates: Partial<User> = {};
    if (existing.role !== 'admin') {
      updates.role = 'admin';
      updates.plan = 'enterprise';
      updates.gpuQuotaHours = 1000;
    }
    if (!(await bcrypt.compare(adminPassword, existing.passwordHash))) {
      updates.passwordHash = await bcrypt.hash(adminPassword, 12);
    }
    if (Object.keys(updates).length > 0) {
      await this.userRepo.update(existing.id, updates);
      this.logger.log(`Admin account synced from env: ${adminEmail}`);
    }
  }

  async create(email: string, name: string, password: string): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = this.userRepo.create({
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'user',
      plan: 'free',
      gpuQuotaHours: 10,
      usedGpuHours: 0,
    });
    return this.userRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Admin only — returns all users */
  findAllUsers(): Promise<User[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** Admin only — count total users */
  countUsers(): Promise<number> {
    return this.userRepo.count();
  }

  sanitize(user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
