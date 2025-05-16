// src/logging/file-logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileLoggerService implements LoggerService {
  private logStream: fs.WriteStream;
  private readonly logDir: string;
  private readonly logFile: string;
  private readonly enableFileLogging: boolean;

  constructor(private configService: ConfigService) {
    this.enableFileLogging =
      this.configService.get('ENABLE_FILE_LOGGING') === 'true';
    this.logDir = this.configService.get('LOG_DIR') || 'logs';
    this.logFile = path.join(this.logDir, 'application.log');

    if (this.enableFileLogging) {
      this.initializeFileLogging();
    }
  }

  private initializeFileLogging() {
    try {
      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Open log file stream with error handling
      this.logStream = fs.createWriteStream(this.logFile, {
        flags: 'a',
        emitClose: true,
      });

      this.logStream.on('error', (err) => {
        console.error('Log file stream error:', err);
      });
    } catch (err) {
      console.error('Failed to initialize file logging:', err);
    }
  }

  log(message: string, context?: string) {
    this.writeLog('INFO', message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.writeLog('ERROR', message, context, trace);
  }

  warn(message: string, context?: string) {
    this.writeLog('WARN', message, context);
  }

  debug(message: string, context?: string) {
    this.writeLog('DEBUG', message, context);
  }

  verbose(message: string, context?: string) {
    this.writeLog('VERBOSE', message, context);
  }

  private writeLog(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      level,
      context: context || 'Application',
      message,
      ...(trace && { trace }),
    });

    // Conditionally log to file
    if (this.enableFileLogging && this.logStream) {
      try {
        this.logStream.write(`${logEntry}\n`);
      } catch (error) {
        console.error('File write error:', error);
      }
    }
  }

  async onModuleDestroy() {
    if (this.logStream) {
      await new Promise((resolve) => {
        this.logStream.end(resolve);
      });
    }
  }
}
