import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'LLM Forge API',
      version: '1.0.0',
      status: 'ok',
      docs: '/api/docs',
      api: '/api/v1',
    };
  }
}
