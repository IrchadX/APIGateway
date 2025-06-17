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
      transports: [this.createConsoleTransport(), this.createFileTransport()],
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
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : '';
            const traceStr = trace ? ` | trace: ${trace}` : '';

            return `${timestamp} [${ctx}] ${level.toUpperCase()}: ${message}${metaStr}${traceStr}`;
          },
        ),
      ),
    });
  }

  private async sendToFluentBit(level: string, data: any) {
    if (!this.fluentEnabled) return;

    try {
      const tag = `app.${level.toLowerCase()}`;

      // Create a more structured payload
      const payload = {
        timestamp: new Date().toISOString(),
        level: level.toLowerCase(),
        app_name: this.appName,
        context: data.context || this.context,
        message: data.message,
        ...(data.trace && { trace: data.trace }),
        // Include any additional metadata
        ...Object.fromEntries(
          Object.entries(data).filter(
            ([key]) => !['message', 'context', 'trace'].includes(key),
          ),
        ),
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

  log(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    };

    this.logger.info(logData.message, {
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    });
    this.sendToFluentBit('info', logData);
  }

  error(message: any, trace?: string, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      trace,
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    };

    this.logger.error(logData.message, {
      trace,
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    });
    this.sendToFluentBit('error', logData);
  }

  warn(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message: this.formatLogMessage(message),
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    };

    this.logger.warn(logData.message, {
      context: logContext,
      ...(meta.length > 0 && meta[0] ? meta[0] : {}),
    });
    this.sendToFluentBit('warn', logData);
  }

  debug(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const logData = {
        message: this.formatLogMessage(message),
        context: logContext,
        ...(meta.length > 0 && meta[0] ? meta[0] : {}),
      };

      this.logger.debug(logData.message, {
        context: logContext,
        ...(meta.length > 0 && meta[0] ? meta[0] : {}),
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
        ...(meta.length > 0 && meta[0] ? meta[0] : {}),
      };

      this.logger.verbose(logData.message, {
        context: logContext,
        ...(meta.length > 0 && meta[0] ? meta[0] : {}),
      });
      this.sendToFluentBit('verbose', logData);
    } catch (error) {
      console.error('Error in FluentLogger.verbose:', error);
      console.log(`[${context || this.context}] VERBOSE: ${message}`);
    }
  }

  private formatLogMessage(message: any): string {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 0);
    }
    return String(message);
  }

  isInitialized(): boolean {
    return true;
  }
}
