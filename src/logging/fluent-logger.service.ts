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

  constructor(private configService: ConfigService) {
    // Initialize HTTP client for Fluent Bit
    this.axiosInstance = axios.create({
      timeout: 3000,
    });

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

  private async sendToFluentBit(data: any) {
    if (!this.fluentEnabled) return;

    try {
      const payload = {
        tag: this.configService.get('APP_NAME') || 'nest-application',
        timestamp: Math.floor(Date.now() / 1000),
        record: data,
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
    this.sendToFluentBit(logData);
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
    this.sendToFluentBit(logData);
  }

  // Similar implementations for warn, debug, verbose...
  warn(message: any, context?: string, ...meta: any[]) {
    const logContext = context || this.context;
    const logData = {
      message,
      context: logContext,
      level: 'warn',
      ...(meta[0] || {}),
    };

    this.logger.warn(message, logData);
    this.sendToFluentBit(logData);
  }

  debug(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      this.logger.debug(message, { context: logContext, ...(meta[0] || {}) });

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
      this.logger.verbose(message, { context: logContext, ...(meta[0] || {}) });
    } catch (error) {
      console.error('Error in FluentLogger.verbose:', error);
      console.log(`[${context || this.context}] VERBOSE: ${message}`);
    }
  }

  isInitialized(): boolean {
    return true;
  }
}
