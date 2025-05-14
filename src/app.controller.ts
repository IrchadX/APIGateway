// src/app.controller.ts
import { Controller, All, Req, Res, Post, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy/proxy.service';
import { AuthService } from './auth/auth.service';
import { LoginDto } from './auth/dto/login.dto';

@Controller()
export class AppController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly authService: AuthService, // Add AuthService
  ) {}

  // Handle login directly in gateway
  @Post('/auth/login')
  async handleLogin(@Body() loginDto: LoginDto, @Res() response: Response) {
    try {
      const result = await this.authService.login(loginDto, response);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(401).json({ error: error.message });
    }
  }

  // Handle logout directly in gateway
  @Post('/auth/logout')
  async handleLogout(@Res() response: Response) {
    try {
      const result = await this.authService.logout(response);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(500).json({ error: error.message });
    }
  }

  // Proxy all other requests to appropriate backends
  @All('/api/*path') async proxyApiRequest(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    this.proxyService.proxyRequest(request).subscribe({
      next: (backendResponse) => {
        response
          .status(backendResponse.status)
          .set(backendResponse.headers)
          .send(backendResponse.data);
      },
      error: (err) => {
        response
          .status(err.response?.status || 500)
          .send(err.response?.data || { error: 'Internal Server Error' });
      },
    });
  }
}
