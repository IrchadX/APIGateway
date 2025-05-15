// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { FluentLogger } from './logging/fluent-logger.service';
import { LoggingModule } from './logging/logging.module';
// import { RequestLoggingInterceptor } from './logging/request-logger.interceptor';
// import { PerformanceInterceptor } from './logging/performance-logger.interceptor';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    console.log('[BOOTSTRAP] App created');

    let fluentLogger;
    try {
      fluentLogger = app.select(LoggingModule).get(FluentLogger);
      console.log('[BOOTSTRAP] FluentLogger loaded');
      app.useLogger(fluentLogger);
    } catch (err) {
      console.error('[BOOTSTRAP] Failed to load FluentLogger:', err);
    }

    try {
      const prismaService = app.get(PrismaService);
      await prismaService.onModuleInit();
      prismaService.enableShutdownHooks(app);
      console.log('[BOOTSTRAP] Prisma initialized');
    } catch (err) {
      console.error('[BOOTSTRAP] Failed during Prisma init:', err);
    }

    try {
      // app.useGlobalInterceptors(
      //   app.get(RequestLoggingInterceptor),
      //   app.get(PerformanceInterceptor),
      // );
      console.log('[BOOTSTRAP] Interceptors registered');
    } catch (err) {
      console.error('[BOOTSTRAP] Failed to register interceptors:', err);
    }

    await app.listen(process.env.PORT || 3512, '0.0.0.0');
    console.log('[BOOTSTRAP] Listening on port:', process.env.PORT || 3512);
  } catch (err) {
    console.error('[BOOTSTRAP] Fatal bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap();

bootstrap().catch((err) => {
  console.error('Application bootstrap failed:', err);
  process.exit(1);
});
