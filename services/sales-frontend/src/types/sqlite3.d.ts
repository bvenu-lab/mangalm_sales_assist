/**
 * Type definitions for sqlite3
 */

declare module 'sqlite3' {
  import { EventEmitter } from 'events';

  export const OPEN_READONLY: number;
  export const OPEN_READWRITE: number;
  export const OPEN_CREATE: number;
  export const OPEN_FULLMUTEX: number;
  export const OPEN_URI: number;
  export const OPEN_SHAREDCACHE: number;
  export const OPEN_PRIVATECACHE: number;
  export const OPEN_NOMUTEX: number;

  export const cached: {
    Database(filename: string, callback?: (err: Error | null) => void): Database;
    Database(filename: string, mode?: number, callback?: (err: Error | null) => void): Database;
  };

  export class Statement extends EventEmitter {
    bind(params: any, callback?: (err: Error | null) => void): this;
    bind(...params: any[]): this;

    reset(callback?: (err: Error | null) => void): this;

    finalize(callback?: (err: Error | null) => void): void;

    run(params: any, callback?: (err: Error | null) => void): this;
    run(...params: any[]): this;

    get(params: any, callback?: (err: Error | null, row?: any) => void): this;
    get(...params: any[]): this;

    all(params: any, callback?: (err: Error | null, rows: any[]) => void): this;
    all(...params: any[]): this;

    each(params: any, callback?: (err: Error | null, row: any) => void, complete?: (err: Error | null, count: number) => void): this;
    each(...params: any[]): this;
  }

  export class Database extends EventEmitter {
    constructor(filename: string, callback?: (err: Error | null) => void);
    constructor(filename: string, mode?: number, callback?: (err: Error | null) => void);

    close(callback?: (err: Error | null) => void): void;

    run(sql: string, params: any, callback?: (err: Error | null) => void): this;
    run(sql: string, ...params: any[]): this;

    get(sql: string, params: any, callback?: (err: Error | null, row: any) => void): this;
    get(sql: string, ...params: any[]): this;

    all(sql: string, params: any, callback?: (err: Error | null, rows: any[]) => void): this;
    all(sql: string, ...params: any[]): this;

    each(sql: string, params: any, callback?: (err: Error | null, row: any) => void, complete?: (err: Error | null, count: number) => void): this;
    each(sql: string, ...params: any[]): this;

    exec(sql: string, callback?: (err: Error | null) => void): this;

    prepare(sql: string, params: any, callback?: (err: Error | null, statement: Statement) => void): Statement;
    prepare(sql: string, ...params: any[]): Statement;

    serialize(callback?: () => void): void;
    parallelize(callback?: () => void): void;

    on(event: 'trace', listener: (sql: string) => void): this;
    on(event: 'profile', listener: (sql: string, time: number) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'open' | 'close', listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;

    configure(option: 'busyTimeout', value: number): void;
    interrupt(): void;
  }

  export function verbose(): sqlite3;

  interface sqlite3 {
    OPEN_READONLY: number;
    OPEN_READWRITE: number;
    OPEN_CREATE: number;
    OPEN_FULLMUTEX: number;
    OPEN_URI: number;
    OPEN_SHAREDCACHE: number;
    OPEN_PRIVATECACHE: number;
    OPEN_NOMUTEX: number;
    
    cached: {
      Database(filename: string, callback?: (err: Error | null) => void): Database;
      Database(filename: string, mode?: number, callback?: (err: Error | null) => void): Database;
    };
    
    Database: typeof Database;
    Statement: typeof Statement;
    verbose(): sqlite3;
  }
}
