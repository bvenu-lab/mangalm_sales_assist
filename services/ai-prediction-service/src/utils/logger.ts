import winston from 'winston';
import config from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = config.server.nodeEnv || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : config.server.logLevel || 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Add service name
  winston.format.label({ label: config.server.serviceName }),
  // Add colors based on log level
  winston.format.colorize({ all: true }),
  // Define the format of the message showing the timestamp, the service name, the level and the message
  winston.format.printf(
    (info) => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use to print out messages
const transports = [
  // Console transport for all logs
  new winston.transports.Console(),
  // File transport for error logs
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // File transport for all logs
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Create a stream object for Morgan
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Export the logger and stream
export { logger, stream };
