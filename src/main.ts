// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { FluentLogger } from './logging/fluent-logger.service';
import { DbLoggingInterceptor } from './logging/db-logging.interceptor';

async function bootstrap() {
  try {
    // Try creating a normal logger first in case Fluent Bit isn't ready
    console.log('Initializing application...');

    let app;
    try {
      app = await NestFactory.create(AppModule, {
        logger: new FluentLogger(),
      });
      console.log('Successfully created app with FluentLogger');
    } catch (loggerError) {
      console.error(
        'Failed to initialize with FluentLogger, falling back to default logger:',
        loggerError,
      );
      app = await NestFactory.create(AppModule);
    }

    app.use(helmet());
    app.useGlobalPipes(new ValidationPipe());

    // Configure CORS if needed
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

    // Set up process error handlers to avoid crashing
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      // Don't exit - let the process continue
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      // Don't exit - let the process continue
    });

    // app.useGlobalInterceptors(new DbLoggingInterceptor(new FluentLogger()));
  } catch (error) {
    console.error('Fatal error during application bootstrap:', error);
    // Wait a bit before exiting to ensure logs are written
    setTimeout(() => process.exit(1), 1000);
  }
}

bootstrap().catch((err) => {
  console.error('Error in bootstrap function:', err);
  // Wait a bit before exiting to ensure logs are written
  setTimeout(() => process.exit(1), 1000);
});
