declare module 'winston' {
  export interface Logger {
    debug(message: string, ...meta: any[]): Logger;
    info(message: string, ...meta: any[]): Logger;
    warn(message: string, ...meta: any[]): Logger;
    error(message: string, ...meta: any[]): Logger;
    http(message: string, ...meta: any[]): Logger;
  }

  export interface LoggerOptions {
    level?: string;
    levels?: { [key: string]: number };
    format?: LoggerFormat;
    transports?: Transport[];
    exitOnError?: boolean;
    silent?: boolean;
  }

  export interface Transport {
    level?: string;
    silent?: boolean;
    handleExceptions?: boolean;
    handleRejections?: boolean;
    format?: LoggerFormat;
  }

  export class Transport {
    constructor(options?: TransportOptions);
  }

  export interface TransportOptions {
    level?: string;
    silent?: boolean;
    handleExceptions?: boolean;
    handleRejections?: boolean;
    format?: LoggerFormat;
  }

  export interface FileTransportOptions extends TransportOptions {
    filename: string;
    maxsize?: number;
    maxFiles?: number;
  }

  export interface ConsoleTransportOptions extends TransportOptions {
    stderrLevels?: string[];
    consoleWarnLevels?: string[];
  }

  export class FileTransport extends Transport {
    constructor(options: FileTransportOptions);
  }

  export class ConsoleTransport extends Transport {
    constructor(options?: ConsoleTransportOptions);
  }

  export interface Transports {
    File: typeof FileTransport;
    Console: typeof ConsoleTransport;
  }

  export interface LoggerFormat {
    transform: (info: any) => any;
    options?: any;
  }

  export interface Format {
    combine(...formats: LoggerFormat[]): LoggerFormat;
    timestamp(options?: { format?: string }): LoggerFormat;
    printf(fn: (info: any) => string): LoggerFormat;
    colorize(options?: { all?: boolean }): LoggerFormat;
    json(): LoggerFormat;
    simple(): LoggerFormat;
    label(options: { label: string }): LoggerFormat;
    prettyPrint(options?: { depth?: number, colorize?: boolean }): LoggerFormat;
  }

  export function createLogger(options: LoggerOptions): Logger;
  export function addColors(colors: { [key: string]: string }): void;
  export const format: Format;
  export const transports: Transports;
}
