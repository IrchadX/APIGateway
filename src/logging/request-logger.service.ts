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
import { FileLoggerService } from './file-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly fluentLogger: FluentLogger,
    private readonly fileLogger: FileLoggerService,
  ) {}

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

    // Log request
    this.logRequest(requestData);

    return next.handle().pipe(
      tap({
        next: (data) => {
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

          this.logResponse({
            statusCode,
            responseTime,
            requestUrl: originalUrl,
            method,
            response: sanitizedResponse,
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
          });
        },
      }),
    );
  }

  private logRequest(requestData: any) {
    const logMessage = `Incoming request: ${requestData.method} ${requestData.url}`;
    this.fluentLogger.log(logMessage, 'HTTP Request', requestData);
    this.fileLogger.log(logMessage, 'HTTP Request');
  }

  private logResponse(responseData: any) {
    const statusCode = responseData.statusCode;
    const level = statusCode >= 400 ? 'error' : 'info';
    const logMessage = `Response: ${responseData.statusCode} ${responseData.method} ${responseData.requestUrl} - ${responseData.responseTime}ms`;

    // Use error level for 4xx and 5xx responses
    if (level === 'error') {
      this.fluentLogger.error(
        logMessage,
        responseData.error?.stack,
        'HTTP Response',
      );
      this.fileLogger.error(
        logMessage,
        responseData.error?.stack,
        'HTTP Response',
      );
    } else {
      this.fluentLogger.log(logMessage, 'HTTP Response', responseData);
      this.fileLogger.log(logMessage, 'HTTP Response');
    }
  }
}
