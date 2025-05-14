// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Check cookies first
          if (request?.cookies?.access_token) {
            return request.cookies.access_token;
          }
          // Fallback to Authorization header
          const authHeader = request?.headers?.authorization;
          if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
            return authHeader.split(' ')[1];
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'fallbackSecret'), // Provide fallback
    });
  }

  async validate(payload: any) {
    return {
      sub: payload.sub, // User ID
      email: payload.email, // User email
      role: payload.role, // User role
    };
  }
}
