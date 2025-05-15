import { Injectable, LoggerService } from '@nestjs/common';
import * as Fluent from 'fluent-logger';

@Injectable()
export class FluentLogger implements LoggerService {
  private logger: Fluent.FluentSender<any>;
  private fallbackLogger = console;

  constructor() {
    try {
      this.logger = Fluent.createFluentSender('nestjs', {
        host: process.env.FLUENT_HOST || 'localhost',
        port: Number(process.env.FLUENT_PORT) || 24224,
        timeout: 3.0,
        reconnectInterval: 5000,
      });
    } catch (error) {
      this.fallbackLogger.error(
        `Failed to initialize FluentBit logger: ${error.message}`,
      );
    }
  }

  log(message: string, context?: string, p0?: unknown) {
    this.sendLog('info', message, context);
  }

  error(message: string, trace: string, context?: string) {
    this.sendLog('error', message, context, { trace });
  }

  warn(
    message: string,
    context?: string,
    perfData?: {
      routeInfo: any;
      controller: any;
      handler: any;
      executionTime: string;
      memoryUsage: {
        before: {
          rss: string;
          heapTotal: string;
          heapUsed: string;
          external: string;
        };
        after: {
          rss: string;
          heapTotal: string;
          heapUsed: string;
          external: string;
        };
        diff: {
          rss: string;
          heapTotal: string;
          heapUsed: string;
          external: string;
        };
      };
      timestamp: string;
    },
  ) {
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

    try {
      this.logger.emit('log', logEntry, (err) => {
        if (err) {
          this.logToConsole(level, message, context, extra);
          this.fallbackLogger.error(
            `Error sending log to FluentBit: ${err.message}`,
          );
        }
      });
    } catch (err) {
      this.logToConsole(level, message, context, extra);
      this.fallbackLogger.error(
        `Unexpected error in FluentLogger: ${err.message}`,
      );
    }
  }

  private logToConsole(
    level: string,
    message: string,
    context?: string,
    extra?: object,
  ) {
    const logMessage = `[${level.toUpperCase()}] [${context || 'Application'}] ${message}`;

    switch (level) {
      case 'error':
        this.fallbackLogger.error(logMessage, extra);
        break;
      case 'warn':
        this.fallbackLogger.warn(logMessage, extra);
        break;
      case 'debug':
      case 'verbose':
        this.fallbackLogger.debug(logMessage, extra);
        break;
      default:
        this.fallbackLogger.log(logMessage, extra);
    }
  }
}
