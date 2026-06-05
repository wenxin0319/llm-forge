import { Injectable, ConflictException, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

const ADMIN_EMAIL = 'cwx0319@gmail.com';
const ADMIN_NAME  = 'Wenxin Cheng';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Runs once after the app fully starts — seeds the admin account */
  async onApplicationBootstrap() {
    const existing = await this.userRepo.findOne({ where: { email: ADMIN_EMAIL } });
    if (!existing) {
      const admin = this.userRepo.create({
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash: await bcrypt.hash('demo1234', 12),
        role: 'admin',
        plan: 'enterprise',
        gpuQuotaHours: 1000,
        usedGpuHours: 0,
      });
      await this.userRepo.save(admin);
      console.log(`[LLM Forge] Admin account seeded: ${ADMIN_EMAIL}`);
    } else if (existing.role !== 'admin') {
      // Promote to admin if already exists as regular user
      await this.userRepo.update(existing.id, { role: 'admin', plan: 'enterprise', gpuQuotaHours: 1000 });
      console.log(`[LLM Forge] Existing account promoted to admin: ${ADMIN_EMAIL}`);
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
