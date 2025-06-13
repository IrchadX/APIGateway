import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { ProxyService } from './proxy/proxy.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingModule } from './logging/logging.module';
import { LogsController } from './logging/logging.controller';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    PrismaModule,
    HttpModule,
    AuthModule,
  ],
  controllers: [AppController, LogsController],
  providers: [
    {
      provide: 'WEB_BACKEND_URL',
      useFactory: (configService: ConfigService) =>
        configService.get('WEB_BACKEND_URL'),
      inject: [ConfigService],
    },
    {
      provide: 'MOBILE_BACKEND_URL',
      useFactory: (configService: ConfigService) =>
        configService.get('MOBILE_BACKEND_URL'),
      inject: [ConfigService],
    },
    {
      provide: 'MOBILE_MAINTENANCIER_BACKEND_URL',
      useFactory: (configService: ConfigService) =>
        configService.get('MOBILE_MAINTENANCIER_BACKEND_URL'),
      inject: [ConfigService],
    },
    ProxyService,
  ],
})
export class AppModule {}
