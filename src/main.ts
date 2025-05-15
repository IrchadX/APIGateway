// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { FluentLogger } from './logging/fluent-logger.service';
import { LoggingModule } from './logging/logging.module';

async function bootstrap() {
  // Create app with custom logger
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until custom logger is registered
  });

  // Get and use FluentLogger as application logger
  const fluentLogger = app.select(LoggingModule).get(FluentLogger);
  app.useLogger(fluentLogger);

  // Get and initialize PrismaService
  const prismaService = app.get(PrismaService);
  await prismaService.onModuleInit();
  prismaService.enableShutdownHooks(app);

  await app.listen(process.env.PORT || 3512, '0.0.0.0');
  fluentLogger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch((err) => {
  console.error('Application bootstrap failed:', err);
  process.exit(1);
});
