// src/logging/file-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileLoggerService implements LoggerService {
  private logStream: fs.WriteStream;
  private readonly logDir: string;
  private readonly logFile: string;

  constructor() {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.logFile = path.join(this.logDir, 'application.log');

    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Open log file stream
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  log(message: string, context?: string) {
    this.writeToFile('INFO', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.writeToFile('ERROR', message, context, trace);
  }

  warn(message: string, context?: string) {
    this.writeToFile('WARN', message, context);
  }

  debug(message: string, context?: string) {
    this.writeToFile('DEBUG', message, context);
  }

  verbose(message: string, context?: string) {
    this.writeToFile('VERBOSE', message, context);
  }

  private writeToFile(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: context || 'Application',
      message,
      ...(trace && { trace }),
    };

    try {
      this.logStream.write(`${JSON.stringify(logEntry)}\n`);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  // Properly close the file stream when the service is destroyed
  onModuleDestroy() {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}
