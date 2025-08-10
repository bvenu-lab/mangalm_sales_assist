import winston from 'winston';

// Create logger
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [pm-orchestrator] ${level}: ${message} ${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/orchestrator.log' })
  ]
});

// Create stream for morgan
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};