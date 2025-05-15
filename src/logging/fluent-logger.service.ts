// src/logging/fluent-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class FluentLogger implements LoggerService {
  private logger: winston.Logger;
  private context: string = 'Application';
  private initialized: boolean = false;

  constructor(private configService: ConfigService) {
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, context, ...meta }) => {
            return `${timestamp} [${context || this.context}] ${level}: ${message} ${
              Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
          },
        ),
      ),
    });

    // Setup the transports array
    const transports: any[] = [consoleTransport];

    try {
      // Check if Fluent Bit logging is enabled through env vars
      const fluentHost =
        this.configService.get<string>('FLUENT_HOST') || 'localhost';
      const fluentPort = parseInt(
        this.configService.get<string>('FLUENT_PORT') || '24224',
        10,
      );

      // We need to dynamically require winston-fluent to avoid dependency issues
      try {
        const fluentTransport = require('winston-fluent').Fluent;
        transports.push(
          new fluentTransport({
            tag: this.configService.get('APP_NAME') || 'nest-application',
            host: fluentHost,
            port: fluentPort,
            timeout: 3.0,
            reconnectInterval: 600000, // 10 minutes
          }),
        );
        console.log(
          `[FluentLogger] Connected to Fluent Bit at ${fluentHost}:${fluentPort}`,
        );
        this.initialized = true;
      } catch (error) {
        console.error(
          '[FluentLogger] Failed to initialize Fluent transport:',
          error,
        );
        console.error(
          '[FluentLogger] Make sure winston-fluent is installed: npm install winston-fluent',
        );
      }
    } catch (error) {
      console.error(
        '[FluentLogger] Error setting up FluentBit logging:',
        error,
      );
    }

    // Create the logger instance
    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL') || 'info',
      transports: transports,
      defaultMeta: {
        service: this.configService.get('APP_NAME') || 'nest-application',
        environment: this.configService.get('NODE_ENV') || 'development',
      },
    });

    // Log a startup message to verify the logger is working
    this.log('FluentLogger initialized', 'Logger');
  }

  setContext(context: string) {
    this.context = context;
    return this;
  }

  log(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      this.logger.info(message, { context: logContext, ...(meta[0] || {}) });

      // Also log to console during development for easier debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[${logContext}] INFO: ${message}`);
      }
    } catch (error) {
      console.error('Error in FluentLogger.log:', error);
      console.log(`[${context || this.context}] INFO: ${message}`);
    }
  }

  error(message: any, trace?: string, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      this.logger.error(message, {
        context: logContext,
        trace,
        ...(meta[0] || {}),
      });

      // Always log errors to console
      console.error(`[${logContext}] ERROR: ${message}`);
      if (trace) console.error(trace);
    } catch (error) {
      console.error('Error in FluentLogger.error:', error);
      console.error(`[${context || this.context}] ERROR: ${message}`);
      if (trace) console.error(trace);
    }
  }

  warn(message: any, context?: string, ...meta: any[]) {
    try {
      const logContext = context || this.context;
      this.logger.warn(message, { context: logContext, ...(meta[0] || {}) });

      // Also log warnings to console during development
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[${logContext}] WARN: ${message}`);
      }
    } catch (error) {
      console.error('Error in FluentLogger.warn:', error);
      console.warn(`[${context || this.context}] WARN: ${message}`);
    }
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

  // Method to check if the logger is properly initialized with Fluent Bit
  isInitialized(): boolean {
    return this.initialized;
  }
}
