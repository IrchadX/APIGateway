// src/logging/logging.module.ts
import { Module, Global } from '@nestjs/common';
import { FluentLogger } from './fluent-logger.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLoggingInterceptor } from './request-logger.interceptor';
import { PerformanceInterceptor } from './performance-logger.interceptor';
import { DbLoggingInterceptor } from './db-logging.interceptor';

import { FileLoggerService } from './file-logger.service';
@Global()
@Module({
  providers: [
    FluentLogger,
    FileLoggerService,
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
  exports: [FluentLogger, FileLoggerService],
})
export class LoggingModule {}
