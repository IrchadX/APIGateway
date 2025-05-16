// src/logging/logging.module.ts
import { Module, Global } from '@nestjs/common';
import { FluentLogger } from './fluent-logger.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLoggingInterceptor } from './request-logger.service';
import { PerformanceInterceptor } from './performance-logger.interceptor';
import { DbLoggingInterceptor } from './db-logging.interceptor';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaModule } from 'src/prisma/prisma.module';
@Global()
@Module({
  providers: [
    PrismaService,
    FluentLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DbLoggingInterceptor,
    },
  ],
  exports: [FluentLogger],
  imports: [PrismaModule],
})
export class LoggingModule {}
