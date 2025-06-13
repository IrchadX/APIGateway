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
  private lastErrorTime: number = 0; // Track last error time to avoid log spam

  constructor(private configService: ConfigService) {
    // Get the log directory
    this.logDir = process.env.LOG_DIR || '/tmp/logs';

    // Initialize HTTP client for Fluent Bit
    this.axiosInstance = axios.create({
      timeout: 1000, // Reduce timeout to fail faster
      // Add retry logic
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Handle anything but server errors
      },
    });

    // Get app name for tagging
    this.appName = this.configService.get('APP_NAME') || 'nest';

    // Configure Fluent Bit logging
    this.configureFluentBit();

    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL') || 'info',
      transports: [
        this.createConsoleTransport(),
        this.createFileTransport('info'),
        this.createFileTransport('error'),
        this.createFileTransport('warn'),
        this.createFileTransport('debug'),
      ],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    });
  }

  async onModuleInit() {
    // Test log directory access and writing capability
    try {
      // Ensure log directory exists
      if (!fs.existsSync(this.logDir)) {
        console.log(`Creating log directory: ${this.logDir}`);
        try {
          fs.mkdirSync(this.logDir, { recursive: true });
        } catch (error: any) {
          console.error(`Failed to create log directory: ${error.message}`);
        }
      }

      // Test writing to log directory
      const testFile = path.join(this.logDir, 'test_logger.log');
      console.log(`Testing file write to: ${testFile}`);
      fs.writeFileSync(testFile, 'Logger initialization test', 'utf8');
      console.log('Successfully wrote test file');

      // Clean up test file
      fs.unlinkSync(testFile);
      console.log('Successfully cleaned up test file');

      // List directory contents
      console.log(
        `Log directory contents: ${fs.readdirSync(this.logDir).join(', ')}`,
      );

      // Test Fluent Bit connection
      if (this.fluentEnabled) {
        await this.sendToFluentBit('info', {
          message: 'Logger initialization successful',
          context: this.context,
        });
        console.log('Successfully sent test message to Fluent Bit');
      }
    } catch (error: any) {
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
      this.configService.get<string>('FLUENT_ENABLED') !== 'false'; // Default to enabled

    if (this.fluentEnabled) {
      const fluentHost =
        this.configService.get<string>('FLUENT_HOST') || 'localhost';
      const fluentPort =
        this.configService.get<string>('FLUENT_PORT') || '24224';

      // Always use HTTP endpoint in this configuration
      this.fluentEndpoint = `http://${fluentHost}:${fluentPort}`;

      console.log(`Fluent Bit logging endpoint: ${this.fluentEndpoint}`);
    }
  }

  private createConsoleTransport() {
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, context, ...meta }) => {
            return `${timestamp} [${context || this.context}] ${level}: ${message} ${
              Object.keys(meta).length
                ? inspect(meta, { depth: null, colors: true })
                : ''
            }`;
          },
        ),
      ),
    });
  }

  private createFileTransport(level: string) {
    return new winston.transports.DailyRotateFile({
      level: level,
      filename: path.join(this.logDir, `${level}-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            // Create a structured but readable format
            const logEntry: Record<string, any> = {
              timestamp,
              level: level.toUpperCase(),
              context: context || this.context,
              app: this.appName,
              message:
                typeof message === 'object' ? JSON.stringify(message) : message,
            };

            if (trace) {
              logEntry.trace = trace;
            }

            if (Object.keys(meta).length > 0) {
              logEntry.metadata = meta;
            }

            // Pretty print with proper indentation for readability
            return JSON.stringify(logEntry, null, 2);
          },
        ),
      ),
    });
  }

  private async sendToFluentBit(level: string, data: any) {
    if (!this.fluentEnabled) return;

    try {
      // Create the exact tag format that Fluent Bit expects (app.level)
      const tag = `app.${level.toLowerCase()}`;

      const payload: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level: level.toLowerCase(),
        app_name: this.appName,
        context: data.context || this.context,
        message: data.message,
        tag: tag,
      };

      // Include trace if present
      if (data.trace) {
        payload.trace = data.trace;
      }

      // Include any additional metadata
      if (data.metadata) {
        payload.metadata = data.metadata;
      }

      // Flatten any other properties
      Object.keys(data).forEach((key) => {
        if (!['message', 'context', 'trace', 'metadata'].includes(key)) {
          payload[key] = data[key];
        }
      });

      // Using a timeout and catch to avoid hanging the application
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500); // 500ms timeout

      try {
        // Send to Fluent Bit's configured HTTP endpoint
        await this.axiosInstance.post(this.fluentEndpoint, payload, {
          signal: controller.signal,
        });

        // Debug logging for development
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`Sent log to Fluent Bit: ${tag}`);
        }
      } catch (innerError: any) {
        // Only show connection errors once every 10 seconds to avoid log spam
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
    } catch (error: any) {
      // Only log outer errors once every 10 seconds
      const now = Date.now();
      if (!this.lastErrorTime || now - this.lastErrorTime > 10000) {
        console.error('Error in sendToFluentBit:', error.message);
        this.lastErrorTime = now;
      }
    }
  }

  // Modified log methods to include Fluent Bit forwarding
  log(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const metaData =
      meta.length > 0 && meta[0] && typeof meta[0] === 'object' ? meta[0] : {};

    const logData: Record<string, any> = {
      message: this.formatLogMessage(message),
      context: logContext,
    };

    if (meta.length > 0 && meta[0]) {
      logData.metadata = meta[0];
    }

    const winstonData: Record<string, any> = { context: logContext };
    Object.assign(winstonData, metaData);

    this.logger.info(message, winstonData);
    this.sendToFluentBit('info', logData);
  }

  error(message: any, trace?: string, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const metaData =
      meta.length > 0 && meta[0] && typeof meta[0] === 'object' ? meta[0] : {};

    const logData: Record<string, any> = {
      message: this.formatLogMessage(message),
      context: logContext,
    };

    if (trace) {
      logData.trace = trace;
    }

    if (meta.length > 0 && meta[0]) {
      logData.metadata = meta[0];
    }

    const winstonData: Record<string, any> = { trace, context: logContext };
    Object.assign(winstonData, metaData);

    this.logger.error(message, winstonData);
    this.sendToFluentBit('error', logData);
  }

  warn(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const metaData =
      meta.length > 0 && meta[0] && typeof meta[0] === 'object' ? meta[0] : {};

    const logData: Record<string, any> = {
      message: this.formatLogMessage(message),
      context: logContext,
    };

    if (meta.length > 0 && meta[0]) {
      logData.metadata = meta[0];
    }

    const winstonData: Record<string, any> = { context: logContext };
    Object.assign(winstonData, metaData);

    this.logger.warn(message, winstonData);
    this.sendToFluentBit('warn', logData);
  }

  debug(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const metaData =
        meta.length > 0 && meta[0] && typeof meta[0] === 'object'
          ? meta[0]
          : {};

      const logData: Record<string, any> = {
        message: this.formatLogMessage(message),
        context: logContext,
      };

      if (meta.length > 0 && meta[0]) {
        logData.metadata = meta[0];
      }

      const winstonData: Record<string, any> = { context: logContext };
      Object.assign(winstonData, metaData);

      this.logger.debug(message, winstonData);
      this.sendToFluentBit('debug', logData);
    } catch (error: any) {
      console.error('Error in FluentLogger.debug:', error);
      console.debug(`[${context || this.context}] DEBUG: ${message}`);
    }
  }

  verbose(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const metaData =
        meta.length > 0 && meta[0] && typeof meta[0] === 'object'
          ? meta[0]
          : {};

      const logData: Record<string, any> = {
        message: this.formatLogMessage(message),
        context: logContext,
      };

      if (meta.length > 0 && meta[0]) {
        logData.metadata = meta[0];
      }

      const winstonData: Record<string, any> = { context: logContext };
      Object.assign(winstonData, metaData);

      this.logger.verbose(message, winstonData);
      this.sendToFluentBit('verbose', logData);
    } catch (error: any) {
      console.error('Error in FluentLogger.verbose:', error);
      console.log(`[${context || this.context}] VERBOSE: ${message}`);
    }
  }

  private formatLogMessage(message: any): string {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2);
    }
    return String(message);
  }

  isInitialized(): boolean {
    return true;
  }
}
