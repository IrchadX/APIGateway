// src/logging/fluent-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { inspect } from 'util';
import axios from 'axios';

@Injectable()
export class FluentLogger implements LoggerService {
  private logger: winston.Logger;
  private context: string = 'Application';
  private fluentEnabled: boolean = false;
  private fluentEndpoint: string;
  private axiosInstance;
  private appName: string;

  constructor(private configService: ConfigService) {
    // Initialize HTTP client for Fluent Bit
    this.axiosInstance = axios.create({
      timeout: 3000,
    });

    // Get app name for tagging
    this.appName = this.configService.get('APP_NAME') || 'nest';

    // Configure Fluent Bit logging
    this.configureFluentBit();

    // Create Winston logger (console transport only)
    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL') || 'info',
      transports: [this.createConsoleTransport()],
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    });
  }

  private configureFluentBit() {
    this.fluentEnabled =
      this.configService.get<string>('FLUENT_ENABLED') === 'true';

    if (this.fluentEnabled) {
      const fluentHost =
        this.configService.get<string>('FLUENT_HOST') || 'localhost';
      const fluentPort =
        this.configService.get<string>('FLUENT_PORT') || '24224';
      const fluentHttpPort =
        this.configService.get<string>('FLUENT_HTTP_PORT') || '9880';

      // Choose either HTTP or TCP endpoint
      const useHttp =
        this.configService.get<string>('FLUENT_USE_HTTP') === 'true';
      this.fluentEndpoint = useHttp
        ? `http://${fluentHost}:${fluentHttpPort}/nest`
        : `http://${fluentHost}:${fluentPort}`; // Still using http for consistency

      console.log(
        `Fluent Bit logging ${useHttp ? 'HTTP' : 'TCP'} endpoint: ${this.fluentEndpoint}`,
      );
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

  private async sendToFluentBit(level: string, data: any) {
    if (!this.fluentEnabled) return;

    try {
      // Important: Tag the log with the correct level tag to match fluent-bit.conf
      const tag = `${this.appName}.${level.toLowerCase()}`;

      const payload = {
        tag,
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          ...data,
          timestamp: new Date().toISOString(), // Add ISO timestamp for parsing
        },
      };

      await this.axiosInstance.post(this.fluentEndpoint, payload);
    } catch (error) {
      console.error('Failed to send log to Fluent Bit:', error.message);
    }
  }

  // Modified log methods to include Fluent Bit forwarding
  log(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message,
      context: logContext,
      level: 'info',
      ...(meta[0] || {}),
    };

    this.logger.info(message, logData);
    this.sendToFluentBit('info', logData);
  }

  error(message: any, trace?: string, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message,
      trace,
      context: logContext,
      level: 'error',
      ...(meta[0] || {}),
    };

    this.logger.error(message, logData);
    this.sendToFluentBit('error', logData);
  }

  warn(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message,
      context: logContext,
      level: 'warn',
      ...(meta[0] || {}),
    };

    this.logger.warn(message, logData);
    this.sendToFluentBit('warn', logData);
  }

  debug(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const logData = {
        message,
        context: logContext,
        level: 'debug',
        ...(meta[0] || {}),
      };

      this.logger.debug(message, logData);
      this.sendToFluentBit('debug', logData);

      // Also log debug to console during development
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[${logContext}] DEBUG: ${message}`);
      }
    } catch (error) {
      console.error('Error in FluentLogger.debug:', error);
      console.debug(`[${context || this.context}] DEBUG: ${message}`);
    }
  }

  verbose(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      const logData = {
        message,
        context: logContext,
        level: 'verbose',
        ...(meta[0] || {}),
      };

      this.logger.verbose(message, logData);
      this.sendToFluentBit('verbose', logData);
    } catch (error) {
      console.error('Error in FluentLogger.verbose:', error);
      console.log(`[${context || this.context}] VERBOSE: ${message}`);
    }
  }

  isInitialized(): boolean {
    return true;
  }
}
