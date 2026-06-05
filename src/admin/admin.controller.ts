import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../common/guards/admin.guard';
import { UsersService } from '../users/users.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all registered users (admin only)' })
  async getAllUsers() {
    const users = await this.usersService.findAllUsers();
    return users.map((u) => this.usersService.sanitize(u));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide statistics (admin only)' })
  async getStats() {
    const total = await this.usersService.countUsers();
    return { totalUsers: total };
  }
}
