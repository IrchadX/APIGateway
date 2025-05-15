// src/logging/performance-logger.interceptor.ts
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
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly fluentLogger: FluentLogger,
    private readonly fileLogger: FileLoggerService,
  ) {
    // Log when the interceptor is created to verify it's working
    console.log('[PerformanceInterceptor] Initialized');
    this.fluentLogger.log('PerformanceInterceptor initialized', 'Interceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const contextType = context.getType();
    let routeInfo: string;

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      routeInfo = `${request.method} ${request.originalUrl}`;
    } else if (contextType === 'rpc') {
      const rpc = context.switchToRpc();
      routeInfo = `RPC: ${rpc.getContext()?.get('pattern') || 'unknown'}`;
    } else if (contextType === 'ws') {
      routeInfo = `WebSocket: ${context.getArgs()[0]?.event || 'unknown'}`;
    } else {
      routeInfo = `Unknown context type: ${contextType}`;
    }

    // Get controller and handler names
    const controllerClass = context.getClass().name;
    const handlerMethod = context.getHandler().name;

    // Record memory usage before execution
    const memBefore = process.memoryUsage();

    return next.handle().pipe(
      tap({
        next: () => {
          try {
            this.recordPerformance({
              routeInfo,
              controllerClass,
              handlerMethod,
              memBefore,
              startTime,
            });
          } catch (error) {
            console.error(
              '[PerformanceInterceptor] Error recording performance:',
              error,
            );
          }
        },
        error: () => {
          try {
            this.recordPerformance({
              routeInfo,
              controllerClass,
              handlerMethod,
              memBefore,
              startTime,
              error: true,
            });
          } catch (error) {
            console.error(
              '[PerformanceInterceptor] Error recording performance on error:',
              error,
            );
          }
        },
      }),
    );
  }

  private recordPerformance(data: any) {
    const endTime = Date.now();
    const executionTime = endTime - data.startTime;
    const memAfter = process.memoryUsage();

    const perfData = {
      routeInfo: data.routeInfo,
      controller: data.controllerClass,
      handler: data.handlerMethod,
      executionTime: `${executionTime}ms`,
      memoryUsage: {
        before: {
          rss: `${Math.round(data.memBefore.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(data.memBefore.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(data.memBefore.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(data.memBefore.external / 1024 / 1024)} MB`,
        },
        after: {
          rss: `${Math.round(memAfter.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memAfter.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memAfter.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memAfter.external / 1024 / 1024)} MB`,
        },
        diff: {
          rss: `${Math.round((memAfter.rss - data.memBefore.rss) / 1024 / 1024)} MB`,
          heapTotal: `${Math.round((memAfter.heapTotal - data.memBefore.heapTotal) / 1024 / 1024)} MB`,
          heapUsed: `${Math.round((memAfter.heapUsed - data.memBefore.heapUsed) / 1024 / 1024)} MB`,
          external: `${Math.round((memAfter.external - data.memBefore.external) / 1024 / 1024)} MB`,
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Set warning levels based on execution time
    let level = 'info';
    let message = `Performance: ${data.routeInfo} completed in ${executionTime}ms`;

    if (executionTime > 1000) {
      level = 'warn';
      message = `Performance warning: ${data.routeInfo} slow execution (${executionTime}ms)`;
    }

    if (data.error) {
      level = 'error';
      message = `Performance error: ${data.routeInfo} failed after ${executionTime}ms`;
    }

    // Always log to console in non-production environments
    if (process.env.NODE_ENV !== 'production' || level !== 'info') {
      console.log(`[Performance] ${message}`);
    }

    // Log to Fluent and file
    try {
      if (level === 'warn') {
        this.fluentLogger.warn(message, 'Performance', perfData);
        this.fileLogger.warn(message, 'Performance');
      } else if (level === 'error') {
        this.fluentLogger.error(message, '', 'Performance', perfData);
        this.fileLogger.error(message, '', 'Performance');
      } else {
        this.fluentLogger.log(message, 'Performance', perfData);
        this.fileLogger.log(message, 'Performance');
      }
    } catch (error) {
      console.error(
        '[PerformanceInterceptor] Error logging performance metrics:',
        error,
      );
    }
  }
}
