// src/logs/logs.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('logs')
export class LoggingController {
  @Get('download')
  async downloadLogs(@Res() res: Response) {
    const logDir = path.join(process.cwd(), 'logs');
    const latestLog = fs
      .readdirSync(logDir)
      .filter((file) => file.endsWith('.log'))
      .sort()
      .pop();

    if (!latestLog) {
      return res.status(404).send('No logs found');
    }

    const logPath = path.join(logDir, latestLog);
    res.download(logPath, `logs-${new Date().toISOString()}.log`);
  }
}
