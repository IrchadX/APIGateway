import { Injectable, LoggerService, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { inspect } from 'util';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FluentLogger implements LoggerService, OnModuleInit {
  private logger: winston.Logger;
  private context: string = 'Application';
  private fluentEnabled: boolean = false;
  private fluentEndpoint: string;
  private axiosInstance;
  private appName: string;
  private logDir: string;
  private lastErrorTime: number = 0;

  constructor(private configService: ConfigService) {
    this.logDir = process.env.LOG_DIR || '/tmp/logs';

    this.axiosInstance = axios.create({
      timeout: 1000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

    this.appName = this.configService.get('APP_NAME') || 'nest';
    this.configureFluentBit();

    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL') || 'info',
      transports: [
        this.createConsoleTransport(),
        this.createFileTransport(),
        this.createStackTraceTransport(), // Separate transport for detailed logs
      ],
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    });
  }

  async onModuleInit() {
    try {
      if (!fs.existsSync(this.logDir)) {
        console.log(`Creating log directory: ${this.logDir}`);
        try {
          fs.mkdirSync(this.logDir, { recursive: true });
        } catch (error) {
          console.error(`Failed to create log directory: ${error.message}`);
        }
      }

      const testFile = path.join(this.logDir, 'test_logger.log');
      console.log(`Testing file write to: ${testFile}`);
      fs.writeFileSync(testFile, 'Logger initialization test', 'utf8');
      console.log('Successfully wrote test file');
      fs.unlinkSync(testFile);
      console.log('Successfully cleaned up test file');
      console.log(
        `Log directory contents: ${fs.readdirSync(this.logDir).join(', ')}`,
      );

      if (this.fluentEnabled) {
        await this.sendToFluentBit('info', {
          message: 'Logger initialization successful',
          context: this.context,
        });
        console.log('Successfully sent test message to Fluent Bit');
      }
    } catch (error) {
      console.error(`Logger initialization error: ${error.message}`);
      console.error(`Current process user: ${process.getuid?.() || 'unknown'}`);
      console.error(
        `Log directory permissions: ${
          fs.existsSync(this.logDir)
            ? fs.statSync(this.logDir).mode.toString(8)
            : 'directory does not exist'
        }`,
      );
    }
  }

  private configureFluentBit() {
    this.fluentEnabled =
      this.configService.get<string>('FLUENT_ENABLED') !== 'false';

    if (this.fluentEnabled) {
      const fluentHost =
        this.configService.get<string>('FLUENT_HOST') || 'localhost';
      const fluentPort =
        this.configService.get<string>('FLUENT_PORT') || '24224';
      this.fluentEndpoint = `http://${fluentHost}:${fluentPort}`;
      console.log(`Fluent Bit logging endpoint: ${this.fluentEndpoint}`);
    }
  }

  private createConsoleTransport() {
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            const ctx = context || this.context;
            const metaStr = Object.keys(meta).length
              ? ` ${inspect(meta, { depth: 2, colors: true, compact: true })}`
              : '';
            const traceStr = trace ? `\n${trace}` : '';

            return `${timestamp} [${ctx}] ${level}: ${message}${metaStr}${traceStr}`;
          },
        ),
      ),
    });
  }

  private createFileTransport() {
    return new winston.transports.File({
      filename: path.join(this.logDir, 'application.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            const ctx = context || this.context;

            // Better handling of complex metadata
            let metaStr = '';
            if (Object.keys(meta).length > 0) {
              try {
                // Use JSON.stringify with proper handling of circular references and depth
                metaStr = ` | meta: ${JSON.stringify(meta, this.getCircularReplacer(), 2)}`;
              } catch (error) {
                metaStr = ` | meta: [Complex object - JSON stringify failed: ${error.message}]`;
              }
            }

            const traceStr = trace ? ` | trace: ${trace}` : '';

            return `${timestamp} [${ctx}] ${level.toUpperCase()}: ${message}${metaStr}${traceStr}`;
          },
        ),
      ),
    });
  }

  // New transport specifically for detailed stack traces and complex data
  private createStackTraceTransport() {
    return new winston.transports.File({
      filename: path.join(this.logDir, 'detailed.log'),
      maxsize: 50 * 1024 * 1024, // 50MB for detailed logs
      maxFiles: 3,
      level: 'debug', // Capture all levels
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.json(), // Use JSON format for structured data
        winston.format.printf((info) => {
          // Custom formatter that handles complex objects better
          try {
            return JSON.stringify(
              {
                timestamp: info.timestamp,

                context: info.context,
                ...info,
              },
              this.getCircularReplacer(),
              2,
            );
          } catch (error) {
            return JSON.stringify({
              timestamp: info.timestamp,
              level: info.level,
              message: info.message,
              context: info.context,
              error: `Failed to serialize log data: ${error.message}`,
            });
          }
        }),
      ),
    });
  }

  // Helper to handle circular references in JSON.stringify
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  private async sendToFluentBit(level: string, data: any) {
    if (!this.fluentEnabled) return;

    try {
      const tag = `app.${level.toLowerCase()}`;

      // Create a more structured payload with better serialization
      const payload = {
        timestamp: new Date().toISOString(),
        level: level.toLowerCase(),
        app_name: this.appName,
        context: data.context || this.context,
        message: data.message,
        ...(data.trace && { trace: data.trace }),
        // Serialize complex objects properly for Fluent Bit
        metadata: this.serializeMetadata(data),
        tag: tag,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);

      try {
        await this.axiosInstance.post(this.fluentEndpoint, payload, {
          signal: controller.signal,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.debug(`Sent log to Fluent Bit: ${tag}`);
        }
      } catch (innerError) {
        const now = Date.now();
        if (!this.lastErrorTime || now - this.lastErrorTime > 10000) {
          console.error(
            'Failed to send log to Fluent Bit:',
            innerError.code === 'ECONNREFUSED'
              ? 'Connection refused'
              : innerError.message,
          );
          this.lastErrorTime = now;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const now = Date.now();
      if (!this.lastErrorTime || now - this.lastErrorTime > 10000) {
        console.error('Error in sendToFluentBit:', error.message);
        this.lastErrorTime = now;
      }
    }
  }

  private serializeMetadata(data: any): any {
    try {
      const filtered = Object.fromEntries(
        Object.entries(data).filter(
          ([key]) => !['message', 'context', 'trace'].includes(key),
        ),
      );

      // Convert to JSON and back to ensure serialization works
      return JSON.parse(JSON.stringify(filtered, this.getCircularReplacer()));
    } catch (error) {
      return {
        serializationError: error.message,
        originalKeys: Object.keys(data),
      };
    }
  }

  log(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      context: logContext,
      ...(meta.length > 0 && meta[0] ? this.sanitizeMetadata(meta[0]) : {}),
    };

    // Log with all metadata properly structured
    this.logger.info(logData.message, {
      context: logContext,
      ...logData,
    });

    this.sendToFluentBit('info', logData);
  }

  error(message: any, trace?: string, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      trace,
      context: logContext,
      ...(meta.length > 0 && meta[0] ? this.sanitizeMetadata(meta[0]) : {}),
    };

    this.logger.error(logData.message, {
      trace,
      context: logContext,
      ...logData,
    });

    this.sendToFluentBit('error', logData);
  }

  warn(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      context: logContext,
      ...(meta.length > 0 && meta[0] ? this.sanitizeMetadata(meta[0]) : {}),
    };

    this.logger.warn(logData.message, {
      context: logContext,
      ...logData,
    });

    this.sendToFluentBit('warn', logData);
  }

  debug(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const logData = {
        message: this.formatLogMessage(message),
        context: logContext,
        ...(meta.length > 0 && meta[0] ? this.sanitizeMetadata(meta[0]) : {}),
      };

      this.logger.debug(logData.message, {
        context: logContext,
        ...logData,
      });

      this.sendToFluentBit('debug', logData);
    } catch (error) {
      console.error('Error in FluentLogger.debug:', error);
      console.debug(`[${context || this.context}] DEBUG: ${message}`);
    }
  }

  verbose(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const logData = {
        message: this.formatLogMessage(message),
        context: logContext,
        ...(meta.length > 0 && meta[0] ? this.sanitizeMetadata(meta[0]) : {}),
      };

      this.logger.verbose(logData.message, {
        context: logContext,
        ...logData,
      });

      this.sendToFluentBit('verbose', logData);
    } catch (error) {
      console.error('Error in FluentLogger.verbose:', error);
      console.log(`[${context || this.context}] VERBOSE: ${message}`);
    }
  }

  // New method specifically for logging complex request data
  logRequest(message: string, context: string, requestData: any) {
    try {
      const sanitizedData = this.sanitizeMetadata(requestData);

      // Write to both regular and detailed logs
      this.logger.info(message, {
        context,
        requestData: sanitizedData,
        logType: 'REQUEST',
      });

      // Also write detailed stack trace to separate file if present
      if (requestData.stacks || requestData.callStack) {
        this.logger.debug('Request Stack Trace', {
          context: `${context}-STACK`,
          stacks: requestData.stacks,
          callStack: requestData.callStack,
          url: requestData.url,
          method: requestData.method,
          logType: 'STACK_TRACE',
        });
      }

      this.sendToFluentBit('info', { message, context, ...sanitizedData });
    } catch (error) {
      console.error('Error logging request:', error);
      // Fallback to simple logging
      this.logger.info(`${message} [FALLBACK - Complex data logging failed]`, {
        context,
      });
    }
  }

  private sanitizeMetadata(meta: any): any {
    if (!meta || typeof meta !== 'object') {
      return meta;
    }

    try {
      // Create a deep copy that can be safely serialized
      const sanitized = JSON.parse(
        JSON.stringify(meta, this.getCircularReplacer()),
      );

      // Truncate very large stack traces for file logging
      if (sanitized.stacks) {
        Object.keys(sanitized.stacks).forEach((key) => {
          if (
            typeof sanitized.stacks[key] === 'string' &&
            sanitized.stacks[key].length > 5000
          ) {
            sanitized.stacks[key] =
              sanitized.stacks[key].substring(0, 5000) + '\n... [TRUNCATED]';
          }
        });
      }

      return sanitized;
    } catch (error) {
      return {
        error: 'Failed to sanitize metadata',
        originalType: typeof meta,
        keys: Object.keys(meta).slice(0, 10), // First 10 keys for debugging
      };
    }
  }

  private formatLogMessage(message: any): string {
    if (typeof message === 'object') {
      try {
        return JSON.stringify(message, this.getCircularReplacer(), 0);
      } catch (error) {
        return `[Complex object - ${error.message}]`;
      }
    }
    return String(message);
  }

  isInitialized(): boolean {
    return true;
  }
}
