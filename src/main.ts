import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { FluentLogger } from './logging/fluent-logger.service';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  try {
    // Initialize console logger first for bootstrap errors
    console.log('\n[BOOTSTRAP] Starting application...');
    console.log(
      '[BOOTSTRAP] Environment:',
      process.env.NODE_ENV || 'development',
    );

    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      abortOnError: false, // Prevent Nest from crashing on initialization errors
    });

    // Get logger instance
    const logger = app.get(FluentLogger);
    app.useLogger(logger);

    // Error handling for Prisma
    try {
      const prismaService = app.get(PrismaService);
      await prismaService.enableShutdownHooks(app);
      await prismaService.$connect();
      logger.log('Prisma initialized successfully', 'Bootstrap');
    } catch (prismaError) {
      logger.error(
        'Prisma initialization failed',
        prismaError?.stack || prismaError?.message || 'Unknown Prisma error',
        'Bootstrap',
      );
      // Continue without Prisma if it's not critical for your app
    }

    // Enable CORS
    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    // Start server
    const port = process.env.PORT || 3513;
    await app.listen(port);

    logger.log(`Application running on port ${port}`, 'Bootstrap');

    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    // Robust error handling
    const errorMessage =
      error instanceof Error
        ? `${error.message}\nStack Trace: ${error.stack}`
        : String(error);

    console.error('[FATAL] Bootstrap failed:', errorMessage);

    // If logger is available, use it
    try {
      const tempLogger = new FluentLogger(new ConfigService());
      tempLogger.error('Bootstrap failed', errorMessage, 'Bootstrap');
    } catch (loggerError) {
      console.error('Failed to initialize logger:', loggerError);
    }

    process.exit(1);
  }
}

bootstrap();
