import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FluentLogger } from './fluent-logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DbLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly fluentLogger: FluentLogger,
    private readonly prismaService?: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const routeInfo = `${request.method} ${request.originalUrl}`;

    // Setup Prisma query event listener if available
    if (this.prismaService) {
      this.setupPrismaQueryLogging();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const executionTime = Date.now() - startTime;
          // Log DB operation completion
          this.logDbOperation({
            routeInfo,
            executionTime,
            query: request.query || {},
            body: request.body || {},
          });
        },
        error: (error) => {
          const executionTime = Date.now() - startTime;
          // Log DB operation error
          this.logDbOperationError({
            routeInfo,
            executionTime,
            error,
            query: request.query || {},
            body: request.body || {},
          });
        },
      }),
    );
  }

  private setupPrismaQueryLogging() {}

  private logDbOperation(data: any) {
    const message = `Database operation for ${data.routeInfo} completed in ${data.executionTime}ms`;

    this.fluentLogger.log(message, 'Database', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  private logDbOperationError(data: any) {
    const message = `Database error for ${data.routeInfo} after ${data.executionTime}ms: ${data.error.message}`;

    this.fluentLogger.error(message, data.error.stack, 'Database');
  }

  private logPrismaOperation(data: any) {
    const message = `Prisma ${data.action} on ${data.model} completed in ${data.executionTime}ms`;

    this.fluentLogger.log(message, 'Prisma', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
