// src/logging/request-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FluentLogger } from './fluent-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly fluentLogger: FluentLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, ip, body, query, params, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Capture the call stack at request time
    const requestStack = this.captureStack();

    // Remove sensitive information from request
    const sanitizedHeaders = { ...headers };
    ['authorization', 'cookie', 'x-api-key'].forEach(
      (key) => delete sanitizedHeaders[key],
    );

    const requestData = {
      requestId,
      method,
      url: originalUrl,
      ip,
      userAgent,
      body: this.sanitizeBody(body),
      query,
      params,
      headers: sanitizedHeaders,
      callStack: requestStack,
      timestamp: new Date().toISOString(),
    };

    // Use the new logRequest method
    this.fluentLogger.logRequest(
      `Incoming request: ${method} ${originalUrl}`,
      'HTTP Request',
      requestData,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;

          const responseData = {
            requestId,
            statusCode,
            responseTime,
            requestUrl: originalUrl,
            method,
            response: this.sanitizeResponse(data),
            originalRequestStack: requestStack,
            timestamp: new Date().toISOString(),
          };

          this.logResponse(responseData);
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;

          const errorData = {
            requestId,
            statusCode: error.status || 500,
            responseTime,
            requestUrl: originalUrl,
            method,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            originalRequestStack: requestStack,
            timestamp: new Date().toISOString(),
          };

          this.logResponse(errorData);
        },
      }),
    );
  }

  private captureStack(): string {
    try {
      // Create a new Error to capture the current stack trace
      const stackTrace = new Error().stack;

      if (!stackTrace) {
        return 'Stack trace not available';
      }

      // Clean up the stack trace by removing interceptor lines
      const stackLines = stackTrace.split('\n');

      const cleanedStack = stackLines
        .slice(1) // Remove "Error" line
        .filter((line) => {
          // Filter out lines from this interceptor and framework code
          return (
            !line.includes('RequestLoggingInterceptor') &&
            !line.includes('intercept') &&
            !line.includes('captureStack') &&
            !line.includes('node_modules/@nestjs/core') &&
            !line.includes('node_modules/rxjs')
          );
        })
        .slice(0, 15) // Limit to first 15 frames
        .join('\n');

      return cleanedStack || 'No application stack trace available';
    } catch (error) {
      return `Stack capture failed: ${error.message}`;
    }
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    try {
      const sanitized = { ...body };

      // Remove sensitive fields
      ['password', 'token', 'secret', 'key', 'auth'].forEach((field) => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      // Truncate large bodies
      const bodyStr = JSON.stringify(sanitized);
      if (bodyStr.length > 10000) {
        return {
          ...sanitized,
          _truncated: true,
          _originalSize: bodyStr.length,
        };
      }

      return sanitized;
    } catch (error) {
      return { error: 'Failed to sanitize body', type: typeof body };
    }
  }

  private sanitizeResponse(data: any): any {
    if (!data) return data;

    try {
      // Limit response data size
      const dataStr = JSON.stringify(data);
      if (dataStr.length > 5000) {
        return {
          _truncated: true,
          _originalSize: dataStr.length,
          _type: typeof data,
          _preview: dataStr.substring(0, 500) + '...',
        };
      }

      return data;
    } catch (error) {
      return { error: 'Failed to sanitize response', type: typeof data };
    }
  }

  private logResponse(responseData: any) {
    const statusCode = responseData.statusCode;
    const level = statusCode >= 400 ? 'error' : 'info';
    const logMessage = `Response: ${responseData.statusCode} ${responseData.method} ${responseData.requestUrl} - ${responseData.responseTime}ms`;

    if (level === 'error') {
      this.fluentLogger.error(
        logMessage,
        responseData.error?.stack,
        'HTTP Response',
        responseData,
      );
    } else {
      this.fluentLogger.log(logMessage, 'HTTP Response', responseData);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
