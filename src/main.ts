// src/main.ts - Updated to check logging configuration
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { FluentLogger } from './logging/fluent-logger.service';
import { LoggingModule } from './logging/logging.module';

async function bootstrap() {
  try {
    // Setup basic console logging during bootstrap
    console.log('\n[BOOTSTRAP] Starting application...');
    console.log(
      '[BOOTSTRAP] Environment:',
      process.env.NODE_ENV || 'development',
    );
    console.log(
      '[BOOTSTRAP] Using Fluent Host:',
      process.env.FLUENT_HOST || 'not set',
    );
    console.log(
      '[BOOTSTRAP] Using Fluent Port:',
      process.env.FLUENT_PORT || 'not set',
    );

    // Create the NestJS application
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true, // Buffer logs until custom logger is set
    });

    console.log('[BOOTSTRAP] App created');

    // Set up CORS
    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });
    console.log('[BOOTSTRAP] CORS enabled');

    // Create test routes to verify logger is working
    app.use('/api/test-log', (req, res) => {
      const fluentLogger = app.get(FluentLogger);
      fluentLogger.log('Test log route accessed', 'TestEndpoint');
      console.log('[TestEndpoint] Test log route accessed');
      res.json({ message: 'Logger test route - check your logs' });
    });

    // Get and set up the FluentLogger
    try {
      const fluentLogger = app.get(FluentLogger);

      if (fluentLogger.isInitialized()) {
        console.log(
          '[BOOTSTRAP] FluentLogger connected to Fluent Bit successfully',
        );
      } else {
        console.warn(
          '[BOOTSTRAP] FluentLogger initialized but not connected to Fluent Bit',
        );
      }

      // Set the logger as NestJS logger
      app.useLogger(fluentLogger);
      fluentLogger.log('Application bootstrap in progress', 'Bootstrap');

      // Log a test message
      fluentLogger.log('This is a test log message during bootstrap', 'Test');
      fluentLogger.warn(
        'This is a test warning message during bootstrap',
        'Test',
      );
      fluentLogger.error(
        'This is a test error message during bootstrap',
        undefined,
        'Test',
      );
    } catch (err) {
      console.error(
        '[BOOTSTRAP] Failed to load or configure FluentLogger:',
        err?.stack,
      );
    }

    // Initialize Prisma
    try {
      const prismaService = app.get(PrismaService);
      await prismaService.onModuleInit();
      prismaService.enableShutdownHooks(app);
      console.log('[BOOTSTRAP] Prisma initialized');
    } catch (err) {
      console.error('[BOOTSTRAP] Failed during Prisma init:', err?.stack);
    }

    // Log all registered routes for debugging
    const server = app.getHttpServer();
    const router = server._events.request._router;

    console.log('\n[BOOTSTRAP] Registered Routes:');
    router.stack.forEach((layer) => {
      if (layer.route) {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods)
          .join(', ')
          .toUpperCase();
        console.log(`[BOOTSTRAP] ${methods} ${path}`);
      }
    });

    // Start the server
    const port = process.env.PORT || 3513;
    await app.listen(port);
    console.log(`\n[BOOTSTRAP] Application listening on port: ${port}`);

    // Log startup with fluentLogger
    try {
      const fluentLogger = app.get(FluentLogger);
      fluentLogger.log(
        `Server started and listening on port ${port}`,
        'Bootstrap',
        {
          port,
          nodeEnv: process.env.NODE_ENV,
        },
      );
    } catch (err) {
      console.error('[BOOTSTRAP] Failed to log startup message:', err?.stack);
    }

    console.log(
      '[BOOTSTRAP] Application fully initialized. Ready to handle requests.\n',
    );
  } catch (err) {
    console.error('[BOOTSTRAP] Fatal bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Application bootstrap failed:', err);
  process.exit(1);
});
