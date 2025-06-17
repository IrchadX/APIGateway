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

    // Capture the call stack at request time
    const requestStack = this.captureStack();

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
      callStack: requestStack, // Add the call stack
      timestamp: new Date().toISOString(),
    };

    // Log request with stack trace
    this.logRequest(requestData);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;

          let sanitizedResponse = data;
          if (data && typeof data === 'object') {
            sanitizedResponse = { ...data };
          }

          this.logResponse({
            statusCode,
            responseTime,
            requestUrl: originalUrl,
            method,
            response: sanitizedResponse,
            callStack: requestStack, // Include stack in response log too
          });
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;

          this.logResponse({
            statusCode: error.status || 500,
            responseTime,
            requestUrl: originalUrl,
            method,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            callStack: requestStack, // Include original request stack
          });
        },
      }),
    );
  }

  private captureStack(): string {
    // Create a new Error to capture the current stack trace
    const stackTrace = new Error().stack;

    if (!stackTrace) {
      return 'Stack trace not available';
    }

    // Clean up the stack trace by removing the first few lines that are from this interceptor
    const stackLines = stackTrace.split('\n');

    // Remove the first line (Error message) and the lines from this interceptor
    const cleanedStack = stackLines
      .slice(1) // Remove "Error" line
      .filter((line) => {
        // Filter out lines from this interceptor and internal Node.js/NestJS framework code
        return (
          !line.includes('RequestLoggingInterceptor') &&
          !line.includes('intercept') &&
          !line.includes('captureStack') &&
          !line.includes('node_modules/@nestjs') &&
          !line.includes('node_modules/rxjs')
        );
      })
      .join('\n');

    return cleanedStack || 'No application stack trace available';
  }

  private logRequest(requestData: any) {
    const logMessage = `Incoming request: ${requestData.method} ${requestData.url}`;
    this.fluentLogger.log(logMessage, 'HTTP Request', {
      ...requestData,
      stackTrace: requestData.callStack, // Explicitly include stack trace
    });
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
        {
          ...responseData,
          originalRequestStack: responseData.callStack,
        },
      );
    } else {
      this.fluentLogger.log(logMessage, 'HTTP Response', {
        ...responseData,
        originalRequestStack: responseData.callStack,
      });
    }
  }
}
