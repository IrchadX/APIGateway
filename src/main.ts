// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { FluentLogger } from './logging/fluent-logger.service';
import { DbLoggingInterceptor } from './logging/db-logging.interceptor';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: new FluentLogger(),
    });
    app.use(helmet());
    app.useGlobalPipes(new ValidationPipe());

    // Configure CORS to allow credentials
    // app.enableCors({
    //   origin: true, // or specify your frontend URL
    //   credentials: true,
    //   allowedHeaders: ['Content-Type', 'Authorization'],
    //   exposedHeaders: ['set-cookie'],
    // });

    const PORT = process.env.PORT || 3000;
    console.log('Attempting to start on port:', PORT);
    await app.listen(PORT);
    console.log(`Gateway running on ${await app.getUrl()}`);
  } catch (error) {
    console.error('Error initializing FluentLogger:', error);
    process.exit(1); // Gracefully shut down with an error code
  }

  // app.useGlobalInterceptors(new DbLoggingInterceptor(new FluentLogger()));
}
bootstrap();
