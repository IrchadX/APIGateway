// src/proxy/proxy.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { Observable, catchError, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { FluentLogger } from 'src/logging/fluent-logger.service';

interface AuthenticatedUser {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class ProxyService {
  constructor(
    private readonly httpService: HttpService,
    @Inject('WEB_BACKEND_URL') private readonly webBackendUrl: string,
    @Inject('MOBILE_BACKEND_URL') private readonly mobileBackendUrl: string,
    private readonly fluentLogger: FluentLogger,
  ) {}

  handleRequest(request: Request): Observable<AxiosResponse<any>> {
    const url = request.originalUrl;

    if (url.startsWith('/api/v1/web')) {
      return this.proxyRequest(request, this.webBackendUrl, '/api/v1/web');
    }

    if (url.startsWith('/api/v1/mobile')) {
      return this.proxyRequest(
        request,
        this.mobileBackendUrl,
        '/api/v1/mobile',
      );
    }

    throw new Error(`Unsupported route: ${url}`);
  }
  proxyRequest(
    request: Request,
    targetBaseUrl: string,
    stripPrefix: string,
    includeCookies = true,
  ): Observable<AxiosResponse<any>> {
    const pathWithoutPrefix = request.originalUrl.replace(stripPrefix, '');
    const url = `${targetBaseUrl}${pathWithoutPrefix}`;
    const headers = this.cleanHeaders(request.headers);

    if (includeCookies && request.headers.cookie) {
      headers['Cookie'] = request.headers.cookie;
    }

    const user = request.user as AuthenticatedUser;
    const logContext = {
      method: request.method,
      url,
      userId: user?.sub || 'anonymous',
      userEmail: user?.email || 'unknown',
      body: request.body,
      headers,
    };

    const startTime = Date.now();
    const logLabel = 'Proxy Request';

    this.fluentLogger.log(`Proxying request to ${url}`, logLabel, logContext);

    return this.httpService
      .request({
        method: request.method,
        url,
        data: request.body,
        headers,
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          const responseTime = Date.now() - startTime;
          const message = `Proxy success: ${request.method} ${url} (${response.status}) - ${responseTime}ms`;
          this.fluentLogger.log(message, logLabel, {
            ...logContext,
            status: response.status,
            responseTime,
          });
        }),
        catchError((error) => {
          const responseTime = Date.now() - startTime;
          const message = `Proxy error: ${request.method} ${url} - ${responseTime}ms`;
          const errorInfo = {
            message: error.message,
            stack: error.stack,
            status: error.response?.status,
            data: error.response?.data,
          };

          this.fluentLogger.error(message, error.stack, logLabel, {
            ...logContext,
            responseTime,
            error: errorInfo,
          });

          throw error;
        }),
      );
  }

  private cleanHeaders(headers: any): Record<string, string> {
    const { host, 'content-length': _, ...cleanHeaders } = headers;
    return cleanHeaders;
  }

  private getUserContextHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    const user = request.user as AuthenticatedUser;
    headers['X-User-Id'] = user.sub;
    headers['X-User-Email'] = user.email;
    headers['X-User-Roles'] = user.role;

    return headers;
  }
}
