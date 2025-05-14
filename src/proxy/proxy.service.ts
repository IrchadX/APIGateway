// src/proxy/proxy.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  ) {}

  proxyRequest(
    request: Request,
    includeCookies = true,
  ): Observable<AxiosResponse> {
    const pathWithoutPrefix = request.originalUrl.replace(/^\/api/, '');
    const url = `${this.webBackendUrl}${pathWithoutPrefix}`;
    const headers = this.cleanHeaders(request.headers);

    // Forward cookies if present
    if (includeCookies && request.headers.cookie) {
      headers['Cookie'] = request.headers.cookie;
    }

    return this.httpService
      .request({
        method: request.method,
        url,
        data: request.body,
        headers,
        withCredentials: true, // forward session cookies
      })
      .pipe(map((response) => response));
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
