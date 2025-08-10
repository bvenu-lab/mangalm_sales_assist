declare module 'dotenv' {
  export interface DotenvConfigOptions {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
  }

  export interface DotenvConfigOutput {
    parsed?: { [key: string]: string };
    error?: Error;
  }

  export function config(options?: DotenvConfigOptions): DotenvConfigOutput;
  export function parse(src: string | Buffer): { [key: string]: string };
}
