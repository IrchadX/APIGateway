// src/logging/fluent-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
// Add this to your imports
import { inspect } from 'util';

@Injectable()
export class FluentLogger implements LoggerService {
  private logger: winston.Logger;
  private context: string = 'Application';
  private initialized: boolean = false;

  constructor(private configService: ConfigService) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
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
      }),
    ];

    // Enhanced Fluent Bit initialization
    const fluentEnabled =
      this.configService.get<string>('FLUENT_ENABLED') !== 'false';
    if (fluentEnabled) {
      try {
        const fluentHost =
          this.configService.get<string>('FLUENT_HOST') || 'localhost';
        const fluentPort = parseInt(
          this.configService.get<string>('FLUENT_PORT') || '24224',
          10,
        );

        const FluentTransport = require('winston-fluent').Fluent;
        const fluentTransport = new FluentTransport({
          tag: this.configService.get('APP_NAME') || 'nest-application',
          label: 'nestjs',
          host: fluentHost,
          port: fluentPort,
          timeout: 3.0,
          requireAckResponse: true, // Ensure delivery confirmation
        });

        fluentTransport.on('error', (error) => {
          console.error('Fluent Transport Error:', error);
        });

        transports.push(fluentTransport);
        this.initialized = true;
        console.log(
          `Fluent Bit logging enabled at ${fluentHost}:${fluentPort}`,
        );
      } catch (error) {
        console.error('Fluent Bit transport initialization failed:', error);
        this.initialized = false;
      }
    }

    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL') || 'info',
      transports,
      defaultMeta: {
        service: this.configService.get('APP_NAME') || 'nest-application',
        env: this.configService.get('NODE_ENV') || 'development',
      },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(), // Ensure JSON format for Fluent
      ),
    });
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
