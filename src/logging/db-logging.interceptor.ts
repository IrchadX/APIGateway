// src/logging/db-logging.interceptor.ts
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
export class DbLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: FluentLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        this.logger['sendLog']('info', 'Database operation', 'DB', {
          route: request.route?.path,
          method: request.method,
          query: request.query || {},
          body: request.body || {},
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }
}
