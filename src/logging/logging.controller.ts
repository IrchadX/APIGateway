// src/logs/logs.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Controller('logs')
export class LoggingController {
  private readonly logDir: string;

  constructor(private configService: ConfigService) {
    this.logDir = path.join(
      process.cwd(),
      this.configService.get('LOG_DIR') || 'logs',
    );
  }

  @Get('download')
  async downloadLogs(@Res() res: Response) {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.logDir)) {
        return res.status(404).send('Log directory not found');
      }

      const logFiles = fs
        .readdirSync(this.logDir)
        .filter((file) => file.endsWith('.log'))
        .sort()
        .reverse(); // Newest first

      if (logFiles.length === 0) {
        return res.status(404).send('No log files found');
      }

      const latestLog = logFiles[0];
      const logPath = path.join(this.logDir, latestLog);

      // Verify file exists and is readable
      if (!fs.existsSync(logPath)) {
        return res.status(404).send('Log file not found');
      }

      return res.download(logPath, `app-logs-${new Date().toISOString()}.log`);
    } catch (error) {
      console.error('Log download error:', error);
      return res.status(500).send('Failed to download logs');
    }
  }
}
