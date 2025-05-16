// src/app.controller.ts
import { Controller, All, Req, Res, Post, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy/proxy.service';
import { AuthService } from './auth/auth.service';
import { LoginDto } from './auth/dto/login.dto';
import { catchError, firstValueFrom } from 'rxjs';

@Controller()
export class AppController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly authService: AuthService,
  ) {}

  @Post('/auth/login')
  async handleLogin(@Body() loginDto: LoginDto, @Res() response: Response) {
    try {
      const result = await this.authService.login(loginDto, response);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(401).json({ error: error.message });
    }
  }

  @Post('/auth/logout')
  async handleLogout(@Res() response: Response) {
    try {
      const result = await this.authService.logout(response);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(500).json({ error: error.message });
    }
  }

  @All(['web/*', 'mobile/*'])
  async handleProxy(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await firstValueFrom(
        this.proxyService.handleRequest(req).pipe(
          catchError((error) => {
            res
              .status(error?.response?.status || 500)
              .json(error?.response?.data || { message: 'Proxy Error' });
            throw error;
          }),
        ),
      );

      res.set(result.headers);
      res.status(result.status).send(result.data);
    } catch (e) {}
  }
}
