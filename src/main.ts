// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { FluentLogger } from './logging/fluent-logger.service';

async function bootstrap() {
  try {
    console.log('Initializing application...');

    // First create app with console logger only
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'], // Console logger first
      bufferLogs: true, // Buffer logs until logger is ready
    });
    console.log('initializezd app');

    // Then initialize Fluent Bit
    try {
      const fluentLogger = app.get(FluentLogger); // Use DI
      app.useLogger(fluentLogger);
      console.log('Fluent Bit logger initialized');
    } catch (fluentError) {
      console.error(
        'Fluent Bit init failed, using console logger:',
        fluentError,
      );
    }

    // Basic middleware
    app.use(helmet());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    // Get port from Railway environment
    const port = parseInt(process.env.PORT || '3512', 10);

    // Start server
    await app.listen(port, '0.0.0.0');
    console.log(`Application running on ${await app.getUrl()}`);

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}

// Start application
bootstrap().catch((err) => {
  console.error('Unhandled bootstrap error:', err);
  process.exit(1);
});
