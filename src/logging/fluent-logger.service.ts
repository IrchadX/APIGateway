// src/logging/fluent-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as Fluent from 'fluent-logger';

@Injectable()
export class FluentLogger implements LoggerService {
  private logger: Fluent.FluentSender<any>;
  constructor() {
    this.logger = Fluent.createFluentSender('nestjs', {
      host: process.env.FLUENT_HOST || 'localhost',
      port: Number(process.env.FLUENT_PORT) || 24224,
      timeout: 3.0,
    });
  }

  log(message: string, context?: string) {
    this.sendLog('info', message, context);
  }

  error(message: string, trace: string, context?: string) {
    this.sendLog('error', message, context, { trace });
  }

  warn(message: string, context?: string) {
    this.sendLog('warn', message, context);
  }

  debug(message: string, context?: string) {
    this.sendLog('debug', message, context);
  }

  verbose(message: string, context?: string) {
    this.sendLog('verbose', message, context);
  }

  private sendLog(
    level: string,
    message: string,
    context?: string,
    extra?: object,
  ) {
    const logEntry = {
      level,
      message,
      context: context || 'Application',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      ...extra,
    };

    this.logger.emit('log', logEntry);
  }
}
