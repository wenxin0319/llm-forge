import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

  const config = new DocumentBuilder()
    .setTitle('LLM Forge API')
    .setDescription('Platform for training customized, lightweight LLMs with GPU acceleration')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('datasets', 'Dataset upload and management')
    .addTag('models', 'LLM model management')
    .addTag('training', 'Training job orchestration')
    .addTag('gpu-metrics', 'GPU utilization and performance metrics')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
  console.log(`LLM Forge API running on http://localhost:${process.env.PORT ?? 3001}`);
  console.log(`Swagger docs: http://localhost:${process.env.PORT ?? 3001}/api/docs`);
}
bootstrap();
