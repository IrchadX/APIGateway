// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { FluentLogger } from './logging/fluent-logger.service';
import { DbLoggingInterceptor } from './logging/db-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new FluentLogger(),
  });

  app.useGlobalInterceptors(new DbLoggingInterceptor(new FluentLogger()));
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe());

  // Configure CORS to allow credentials
  app.enableCors({
    origin: true, // or specify your frontend URL
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie'],
  });

  await app.listen(3004);
  console.log(`Gateway running on ${await app.getUrl()}`);
}
bootstrap();
