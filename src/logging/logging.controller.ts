// src/logs/logs.controller.ts
import { Controller, Get, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { createReadStream, readFileSync } from 'fs';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

@Controller('logs')
export class LogsController {
  private readonly logDir: string;

  constructor(private configService: ConfigService) {
    // Use the LOG_DIR environment variable
    this.logDir = process.env.LOG_DIR || '/tmp/logs';
    console.log(
      `Logs controller initialized with log directory: ${this.logDir}`,
    );
  }

  @Get('/all')
  getLogs(): string {
    try {
      const logPath = path.join(this.logDir, 'fluent_all.log');
      console.log(`Attempting to read log file at: ${logPath}`);

      if (!fs.existsSync(logPath)) {
        return `Log file not found at ${logPath}. Available files in ${this.logDir}: ${
          fs.existsSync(this.logDir)
            ? fs.readdirSync(this.logDir).join(', ')
            : 'directory does not exist'
        }`;
      }

      return readFileSync(logPath, 'utf-8');
    } catch (error) {
      console.error('Error reading logs:', error);
      return `Error reading logs: ${error.message}`;
    }
  }

  @Get('/warn')
  getWarnLogs(): string {
    try {
      const logPath = path.join(this.logDir, 'fluent_warn.log');
      console.log(`Attempting to read log file at: ${logPath}`);

      if (!fs.existsSync(logPath)) {
        return `Log file not found at ${logPath}. Available files in ${this.logDir}: ${
          fs.existsSync(this.logDir)
            ? fs.readdirSync(this.logDir).join(', ')
            : 'directory does not exist'
        }`;
      }

      return readFileSync(logPath, 'utf-8');
    } catch (error) {
      console.error('Error reading logs:', error);
      return `Error reading logs: ${error.message}`;
    }
  }

  @Get('/error')
  getErrorLogs(): string {
    try {
      const logPath = path.join(this.logDir, 'fluent_error.log');
      console.log(`Attempting to read log file at: ${logPath}`);

      if (!fs.existsSync(logPath)) {
        return `Log file not found at ${logPath}. Available files in ${this.logDir}: ${
          fs.existsSync(this.logDir)
            ? fs.readdirSync(this.logDir).join(', ')
            : 'directory does not exist'
        }`;
      }

      return readFileSync(logPath, 'utf-8');
    } catch (error) {
      console.error('Error reading logs:', error);
      return `Error reading logs: ${error.message}`;
    }
  }

  @Get('/info')
  getInfoLogs(): string {
    try {
      const logPath = path.join(this.logDir, 'fluent_info.log');
      console.log(`Attempting to read log file at: ${logPath}`);

      if (!fs.existsSync(logPath)) {
        return `Log file not found at ${logPath}. Available files in ${this.logDir}: ${
          fs.existsSync(this.logDir)
            ? fs.readdirSync(this.logDir).join(', ')
            : 'directory does not exist'
        }`;
      }

      return readFileSync(logPath, 'utf-8');
    } catch (error) {
      console.error('Error reading logs:', error);
      return `Error reading logs: ${error.message}`;
    }
  }

  @Get('download')
  async downloadLogs(
    @Res() res: Response,
    @Query('all') all: string,
    @Query('type') type: string,
  ) {
    try {
      if (!fs.existsSync(this.logDir)) {
        return res.status(404).send(`Log directory not found: ${this.logDir}`);
      }

      const logFiles = fs
        .readdirSync(this.logDir)
        .filter((file) => file.match(/\.(log|gz)$/))
        .sort()
        .reverse();

      if (logFiles.length === 0) {
        return res.status(404).send(`No log files found in ${this.logDir}`);
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
          logFiles.find((file) => file.includes('fluent')) || logFiles[0];
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
      return res.status(500).send(`Failed to download logs: ${error.message}`);
    }
  }

  @Get('list')
  listLogs() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return { error: `Log directory not found: ${this.logDir}` };
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
      return { error: error.message, directory: this.logDir };
    }
  }
}
