import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Swagger)
      if (!origin) return callback(null, true);
      // Allow any vercel.app or railway.app subdomain in production
      if (allowedOrigins.includes(origin) || /\.(vercel\.app|railway\.app)$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
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
