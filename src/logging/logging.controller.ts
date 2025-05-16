// src/logs/logs.controller.ts
import { Controller, Get, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

@Controller('logs')
export class LogsController {
  private readonly logDir: string;

  constructor(private configService: ConfigService) {
    this.logDir = path.join(
      process.cwd(),
      this.configService.get('LOG_DIR') || 'logs',
    );
  }

  @Get('download')
  async downloadLogs(
    @Res() res: Response,
    @Query('all') all: string,
    @Query('type') type: string,
  ) {
    try {
      if (!fs.existsSync(this.logDir)) {
        return res.status(404).send('Log directory not found');
      }

      const logFiles = fs
        .readdirSync(this.logDir)
        .filter((file) => file.match(/\.(log|gz)$/))
        .sort()
        .reverse();

      if (logFiles.length === 0) {
        return res.status(404).send('No log files found');
      }

      if (all === 'true') {
        // Create a zip of all log files
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.attachment(`all-logs-${new Date().toISOString()}.zip`);
        archive.pipe(res);

        logFiles.forEach((file) => {
          archive.file(path.join(this.logDir, file), { name: file });
        });

        await archive.finalize();
      } else if (type) {
        // Download specific log type (e.g., error, info)
        const matchingFiles = logFiles.filter((file) => file.includes(type));
        if (matchingFiles.length === 0) {
          return res.status(404).send(`No ${type} logs found`);
        }

        const fileToDownload = matchingFiles[0];
        const filePath = path.join(this.logDir, fileToDownload);

        if (fileToDownload.endsWith('.gz')) {
          res.set('Content-Type', 'application/gzip');
          res.attachment(fileToDownload);
          createReadStream(filePath).pipe(res);
        } else {
          res.download(filePath, fileToDownload);
        }
      } else {
        // Default: download the latest application log
        const latestLog =
          logFiles.find((file) => file.includes('application')) || logFiles[0];
        const filePath = path.join(this.logDir, latestLog);

        if (latestLog.endsWith('.gz')) {
          res.set('Content-Type', 'application/gzip');
          res.attachment(latestLog);
          createReadStream(filePath).pipe(res);
        } else {
          res.download(filePath, latestLog);
        }
      }
    } catch (error) {
      console.error('Log download error:', error);
      return res.status(500).send('Failed to download logs');
    }
  }

  @Get('list')
  listLogs() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return { error: 'Log directory not found' };
      }

      const files = fs
        .readdirSync(this.logDir)
        .filter((file) => file.match(/\.(log|gz)$/))
        .sort()
        .reverse()
        .map((file) => ({
          name: file,
          size: fs.statSync(path.join(this.logDir, file)).size,
          modified: fs.statSync(path.join(this.logDir, file)).mtime,
          path: `/logs/download?type=${file.split('.')[0]}`,
        }));

      return {
        directory: this.logDir,
        files,
        downloadAll: '/logs/download?all=true',
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}
