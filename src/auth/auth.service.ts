import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, res: any) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
      include: {
        user_type: true,
      },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    const isPasswordValid = loginDto.password === user.password; // Remove this in production

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userTypeName = user.user_type?.type || 'user';

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.user_type?.type,
    };

    const token = this.jwtService.sign(payload);

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      user: {
        id: user.id,
        firstName: user.first_name,
        familyName: user.family_name,
        email: user.email,
        phoneNumber: user.phone_number,
        role: userTypeName,
      },
    };
  }

  async logout(res: Response) {
    // Clear the HTTP-only cookie
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { user_type: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = pass === user.password;
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    return {
      userId: user.id,
      email: user.email,
      role: user.user_type?.type,
    };
  }
}
