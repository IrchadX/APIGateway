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
    @Query('format') format: string = 'file', // 'file' or 'text'
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

      // Handle ZIP download case
      if (all === 'true' && format === 'file') {
        return this.handleZipDownload(res, logFiles);
      }

      // Handle ALL logs as TEXT
      if (all === 'true' && format === 'text') {
        return this.handleAllTextDownload(res, logFiles);
      }

      // Handle single log as TEXT
      if (format === 'text') {
        return this.handleTextDownload(res, type, logFiles);
      }

      // Handle single file download
      return this.handleFileDownload(res, type, logFiles);
    } catch (error) {
      console.error('Log download error:', error);
      return res.status(500).send(`Failed to download logs: ${error.message}`);
    }
  }

  private async handleAllTextDownload(res: Response) {
    const logFile = 'application.log';
    const filePath = path.join(this.logDir, logFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Consolidated log file not found');
    }

    res.set('Content-Type', 'text/plain');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  private async handleZipDownload(res: Response, logFiles: string[]) {
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`all-logs-${new Date().toISOString()}.zip`);
    archive.pipe(res);

    logFiles.forEach((file) => {
      archive.file(path.join(this.logDir, file), { name: file });
    });

    await archive.finalize();
  }

  private handleTextDownload(res: Response, type: string, logFiles: string[]) {
    if (!type) {
      return res.status(400).send('Type parameter required for text download');
    }

    const matchingFiles = logFiles.filter((file) => file.includes(type));
    if (matchingFiles.length === 0) {
      return res.status(404).send(`No ${type} logs found`);
    }

    const fileToDownload = matchingFiles[0];
    const filePath = path.join(this.logDir, fileToDownload);

    if (fileToDownload.endsWith('.gz')) {
      // Handle gzipped files by decompressing first
      const gunzip = zlib.createGunzip();
      const fileStream = createReadStream(filePath);
      res.set('Content-Type', 'text/plain');
      fileStream.pipe(gunzip).pipe(res);
    } else {
      // Send plain text files directly
      res.set('Content-Type', 'text/plain');
      createReadStream(filePath).pipe(res);
    }
  }

  private handleFileDownload(res: Response, type: string, logFiles: string[]) {
    let fileToDownload: string;

    if (type) {
      const matchingFiles = logFiles.filter((file) => file.includes(type));
      if (matchingFiles.length === 0) {
        return res.status(404).send(`No ${type} logs found`);
      }
      fileToDownload = matchingFiles[0];
    } else {
      // Default to latest application log
      fileToDownload =
        logFiles.find((file) => file.includes('fluent')) || logFiles[0];
    }

    const filePath = path.join(this.logDir, fileToDownload);

    if (fileToDownload.endsWith('.gz')) {
      res.set('Content-Type', 'application/gzip');
      res.attachment(fileToDownload);
    } else {
      res.set('Content-Type', 'text/plain');
      res.attachment(fileToDownload.replace('.log', '.txt'));
    }

    createReadStream(filePath).pipe(res);
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
