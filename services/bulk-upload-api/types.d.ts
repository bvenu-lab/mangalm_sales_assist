// Type declarations for bulk-upload-api to resolve conflicts
declare module 'express' {
  interface Request {
    file?: Express.Multer.File;
  }
}

// Extend global types to resolve conflicts
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

export {};