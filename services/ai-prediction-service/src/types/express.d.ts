declare module 'express' {
  import { Server } from 'http';
  
  export interface Request {
    id?: string;
    body: any;
    params: any;
    query: any;
    headers: any;
    path: string;
    method: string;
    url: string;
    originalUrl: string;
    ip: string;
    protocol: string;
    secure: boolean;
    get(name: string): string | undefined;
  }
  
  export interface Response {
    status(code: number): Response;
    send(body: any): Response;
    json(body: any): Response;
    setHeader(name: string, value: string | string[]): Response;
    getHeader(name: string): string | string[] | number | undefined;
    end(): Response;
    redirect(url: string): Response;
    redirect(status: number, url: string): Response;
    cookie(name: string, val: string, options?: any): Response;
    clearCookie(name: string, options?: any): Response;
    sendFile(path: string, options?: any, callback?: (err?: Error) => void): void;
    download(path: string, filename?: string, callback?: (err?: Error) => void): void;
    type(type: string): Response;
    format(obj: any): Response;
    attachment(filename?: string): Response;
    set(field: any): Response;
    set(field: string, value?: string | string[]): Response;
    vary(field: string): Response;
    append(field: string, value: string | string[]): Response;
  }
  
  export interface NextFunction {
    (err?: any): void;
  }
  
  export interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): any;
  }
  
  export interface ErrorRequestHandler {
    (err: any, req: Request, res: Response, next: NextFunction): any;
  }
  
  export interface Application {
    use(handler: RequestHandler | ErrorRequestHandler): Application;
    use(path: string, handler: RequestHandler | ErrorRequestHandler): Application;
    get(path: string, ...handlers: RequestHandler[]): Application;
    post(path: string, ...handlers: RequestHandler[]): Application;
    put(path: string, ...handlers: RequestHandler[]): Application;
    delete(path: string, ...handlers: RequestHandler[]): Application;
    patch(path: string, ...handlers: RequestHandler[]): Application;
    options(path: string, ...handlers: RequestHandler[]): Application;
    head(path: string, ...handlers: RequestHandler[]): Application;
    all(path: string, ...handlers: RequestHandler[]): Application;
    listen(port: number, callback?: () => void): Server;
    listen(port: number, hostname: string, callback?: () => void): Server;
  }
  
  export interface Router extends RequestHandler {
    use(handler: RequestHandler | ErrorRequestHandler): Router;
    use(path: string, handler: RequestHandler | ErrorRequestHandler): Router;
    get(path: string, ...handlers: RequestHandler[]): Router;
    post(path: string, ...handlers: RequestHandler[]): Router;
    put(path: string, ...handlers: RequestHandler[]): Router;
    delete(path: string, ...handlers: RequestHandler[]): Router;
    patch(path: string, ...handlers: RequestHandler[]): Router;
    options(path: string, ...handlers: RequestHandler[]): Router;
    head(path: string, ...handlers: RequestHandler[]): Router;
    all(path: string, ...handlers: RequestHandler[]): Router;
  }
  
  export function Router(options?: any): Router;
  export function json(options?: any): RequestHandler;
  export function urlencoded(options?: any): RequestHandler;
  export function static(root: string, options?: any): RequestHandler;
  
  interface Express {
    (): Application;
    json: typeof json;
    urlencoded: typeof urlencoded;
    static: typeof static;
    Router: typeof Router;
  }
  
  const express: Express;
  export default express;
}

declare module 'cors' {
  import { RequestHandler } from 'express';
  
  interface CorsOptions {
    origin?: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  }
  
  function cors(options?: CorsOptions): RequestHandler;
  export default cors;
}

declare module 'helmet' {
  import { RequestHandler } from 'express';
  
  interface HelmetOptions {
    contentSecurityPolicy?: boolean | object;
    crossOriginEmbedderPolicy?: boolean | object;
    crossOriginOpenerPolicy?: boolean | object;
    crossOriginResourcePolicy?: boolean | object;
    dnsPrefetchControl?: boolean | object;
    expectCt?: boolean | object;
    frameguard?: boolean | object;
    hidePoweredBy?: boolean | object;
    hsts?: boolean | object;
    ieNoOpen?: boolean | object;
    noSniff?: boolean | object;
    originAgentCluster?: boolean | object;
    permittedCrossDomainPolicies?: boolean | object;
    referrerPolicy?: boolean | object;
    xssFilter?: boolean | object;
  }
  
  function helmet(options?: HelmetOptions): RequestHandler;
  export default helmet;
}

declare module 'compression' {
  import { RequestHandler } from 'express';
  
  interface CompressionOptions {
    threshold?: number;
    level?: number;
    memLevel?: number;
    strategy?: number;
    filter?: (req: any, res: any) => boolean;
    chunkSize?: number;
    windowBits?: number;
  }
  
  function compression(options?: CompressionOptions): RequestHandler;
  export default compression;
}

declare module 'morgan' {
  import { RequestHandler } from 'express';
  
  interface StreamOptions {
    write(str: string): void;
  }
  
  function morgan(format: string | Function, options?: { stream?: StreamOptions; skip?: Function }): RequestHandler;
  export default morgan;
}
