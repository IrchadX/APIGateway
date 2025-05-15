// src/logging/request-logger.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FluentLogger } from './fluent-logger.service';
import { FileLoggerService } from './file-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly fluentLogger: FluentLogger,
    private readonly fileLogger: FileLoggerService,
  ) {
    // Log when the interceptor is created to verify it's working
    console.log('[RequestLoggingInterceptor] Initialized');
    this.fluentLogger.log(
      'RequestLoggingInterceptor initialized',
      'Interceptor',
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, ip, body, query, params, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();

    // Remove sensitive information from request
    const sanitizedHeaders = { ...headers };
    ['authorization', 'cookie', 'x-api-key'].forEach(
      (key) => delete sanitizedHeaders[key],
    );

    const requestData = {
      method,
      url: originalUrl,
      ip,
      userAgent,
      body,
      query,
      params,
      headers: sanitizedHeaders,
    };

    // Always log to console during debugging
    console.log(`[HTTP] Incoming request: ${method} ${originalUrl}`);

    // Log request to Fluent and file
    try {
      this.fluentLogger.log(
        `Incoming request: ${method} ${originalUrl}`,
        'HTTP Request',
        requestData,
      );
      this.fileLogger.log(
        `Incoming request: ${method} ${originalUrl}`,
        'HTTP Request',
      );
    } catch (error) {
      console.error(
        '[RequestLoggingInterceptor] Error logging request:',
        error,
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          try {
            const responseTime = Date.now() - startTime;
            const response = context.switchToHttp().getResponse();
            const { statusCode } = response;

            // Sanitize response if needed
            let sanitizedResponse = data;
            if (data && typeof data === 'object') {
              sanitizedResponse = { ...data };
              // Remove sensitive fields if needed
              // delete sanitizedResponse.password;
              // delete sanitizedResponse.token;
            }

            const logMessage = `Response: ${statusCode} ${method} ${originalUrl} - ${responseTime}ms`;

            // Always log to console during debugging
            console.log(`[HTTP] ${logMessage}`);

            // Log to Fluent and file
            this.fluentLogger.log(logMessage, 'HTTP Response', {
              statusCode,
              responseTime,
              requestUrl: originalUrl,
              method,
            });
            this.fileLogger.log(logMessage, 'HTTP Response');
          } catch (error) {
            console.error(
              '[RequestLoggingInterceptor] Error logging response:',
              error,
            );
          }
        },
        error: (error) => {
          try {
            const responseTime = Date.now() - startTime;
            const logMessage = `Error response: ${error.status || 500} ${method} ${originalUrl} - ${responseTime}ms`;

            // Always log to console
            console.error(`[HTTP] ${logMessage}`, error.message);

            // Log to Fluent and file
            this.fluentLogger.error(logMessage, error.stack, 'HTTP Response', {
              statusCode: error.status || 500,
              responseTime,
              requestUrl: originalUrl,
              method,
              errorMessage: error.message,
            });
            this.fileLogger.error(logMessage, error.stack, 'HTTP Response');
          } catch (loggingError) {
            console.error(
              '[RequestLoggingInterceptor] Error logging error response:',
              loggingError,
            );
          }
        },
      }),
    );
  }
}
