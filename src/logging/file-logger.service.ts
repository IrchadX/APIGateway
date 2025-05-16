// src/logging/file-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileLoggerService implements LoggerService {
  private readonly logDir: string;
  private readonly logFile: string;
  private readonly enableFileLogging: boolean;

  constructor(private configService: ConfigService) {
    this.enableFileLogging =
      this.configService.get('ENABLE_FILE_LOGGING') !== 'false';
    this.logDir = path.join(
      process.cwd(),
      this.configService.get('LOG_DIR') || 'logs',
    );
    this.logFile = path.join(this.logDir, 'application.log');

    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (this.enableFileLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      fs.chmodSync(this.logDir, 0o777); // Ensure writable
    }
  }

  private writeToFile(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ) {
    if (!this.enableFileLogging) return;

    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context: context || 'Application',
      message,
      ...(trace && { trace }),
    });

    try {
      fs.appendFileSync(this.logFile, `${logEntry}\n`, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  // Implement LoggerService methods
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
}
