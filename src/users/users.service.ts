import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  gpuQuotaHours: number;
  usedGpuHours: number;
}

@Injectable()
export class UsersService {
  // In-memory store — replace with a real DB (TypeORM/Prisma) in production
  private readonly users = new Map<string, User>();

  async create(email: string, name: string, password: string): Promise<User> {
    if ([...this.users.values()].find((u) => u.email === email)) {
      throw new ConflictException('Email already registered');
    }
    const user: User = {
      id: uuidv4(),
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      plan: 'free',
      createdAt: new Date(),
      gpuQuotaHours: 10,
      usedGpuHours: 0,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((u) => u.email === email);
  }

  async findById(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  sanitize(user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
