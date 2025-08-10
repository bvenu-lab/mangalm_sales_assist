/**
 * Logger utility for consistent logging across the application
 */
export class Logger {
  /**
   * Log an info message
   * @param message Message to log
   * @param meta Additional metadata
   */
  public info(message: string, meta?: any): void {
    console.info(`[INFO] ${message}`, meta || '');
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param meta Additional metadata
   */
  public error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param meta Additional metadata
   */
  public warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  /**
   * Log a debug message
   * @param message Message to log
   * @param meta Additional metadata
   */
  public debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();
