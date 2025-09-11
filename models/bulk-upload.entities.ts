/**
 * Enterprise Bulk Upload Entity Models
 * 10/10 Architecture - Type-safe, comprehensive tracking
 */

export enum UploadStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  CHUNKING = 'chunking',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIALLY_COMPLETED = 'partially_completed'
}

export enum ChunkStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export enum FileType {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  XML = 'xml'
}

export enum ProcessingStrategy {
  STREAM = 'stream',
  BATCH = 'batch',
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential'
}

/**
 * Main upload job entity
 */
export interface UploadJob {
  id: string;
  fileName: string;
  fileType: FileType;
  fileSizeBytes: number;
  fileHash: string;
  
  // Processing
  status: UploadStatus;
  strategy: ProcessingStrategy;
  priority: number;
  
  // Progress tracking
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  duplicateRows: number;
  
  // Performance metrics
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  rowsPerSecond?: number;
  avgRowProcessingMs?: number;
  peakMemoryMb?: number;
  
  // Validation
  validationErrors?: ValidationError[];
  schemaVersion: string;
  
  // User tracking
  userId: string;
  organizationId?: string;
  ipAddress: string;
  userAgent: string;
  
  // Metadata
  metadata?: Record<string, any>;
  tags?: string[];
  retryCount: number;
  maxRetries: number;
  
  // References
  parentJobId?: string;
  s3Key?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload chunk for parallel processing
 */
export interface UploadChunk {
  id: string;
  uploadId: string;
  
  // Chunk details
  chunkNumber: number;
  startRow: number;
  endRow: number;
  rowCount: number;
  sizeBytes: number;
  
  // Processing
  status: ChunkStatus;
  workerId?: string;
  attempts: number;
  
  // Performance
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingTimeMs?: number;
  
  // Results
  successCount: number;
  failureCount: number;
  errors?: ProcessingError[];
  
  // Data reference
  dataLocation?: string;
  checksum?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Processing error details
 */
export interface ProcessingError {
  id: string;
  uploadId: string;
  chunkId?: string;
  
  // Error location
  rowNumber: number;
  columnName?: string;
  rawData?: string;
  
  // Error details
  errorType: ErrorType;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  
  // Resolution
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  
  // Retry info
  retryable: boolean;
  retryCount: number;
  lastRetryAt?: Date;
  
  createdAt: Date;
}

export enum ErrorType {
  VALIDATION = 'validation',
  PARSING = 'parsing',
  PROCESSING = 'processing',
  BUSINESS_LOGIC = 'business_logic',
  DATABASE = 'database',
  DUPLICATE = 'duplicate',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  TIMEOUT = 'timeout',
  SYSTEM = 'system'
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  value: any;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Deduplication tracking
 */
export interface DeduplicationRecord {
  id: string;
  uploadId: string;
  
  // Dedup key
  recordHash: string;
  businessKey: string;
  
  // Original record
  originalUploadId: string;
  originalRowNumber: number;
  originalTimestamp: Date;
  
  // Duplicate info
  duplicateCount: number;
  lastSeenAt: Date;
  
  // Action taken
  action: DeduplicationAction;
  mergedData?: Record<string, any>;
  
  createdAt: Date;
}

export enum DeduplicationAction {
  SKIP = 'skip',
  UPDATE = 'update',
  MERGE = 'merge',
  APPEND = 'append',
  REPLACE = 'replace'
}

/**
 * Upload audit log
 */
export interface UploadAuditLog {
  id: string;
  uploadId: string;
  
  // Event
  eventType: AuditEventType;
  eventData: Record<string, any>;
  
  // Actor
  userId: string;
  userRole?: string;
  ipAddress: string;
  
  // Context
  previousState?: any;
  newState?: any;
  changeSet?: Record<string, any>;
  
  // System
  serviceVersion: string;
  serverHostname: string;
  
  timestamp: Date;
}

export enum AuditEventType {
  UPLOAD_STARTED = 'upload_started',
  UPLOAD_VALIDATED = 'upload_validated',
  UPLOAD_CHUNKED = 'upload_chunked',
  CHUNK_PROCESSING_STARTED = 'chunk_processing_started',
  CHUNK_PROCESSING_COMPLETED = 'chunk_processing_completed',
  CHUNK_PROCESSING_FAILED = 'chunk_processing_failed',
  UPLOAD_COMPLETED = 'upload_completed',
  UPLOAD_FAILED = 'upload_failed',
  UPLOAD_CANCELLED = 'upload_cancelled',
  UPLOAD_RETRIED = 'upload_retried',
  DATA_EXPORTED = 'data_exported',
  ERROR_RESOLVED = 'error_resolved'
}

/**
 * Progress update for SSE
 */
export interface ProgressUpdate {
  uploadId: string;
  status: UploadStatus;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  duplicateRows: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  currentChunk?: number;
  totalChunks?: number;
  message?: string;
  errors?: Array<{
    row: number;
    message: string;
  }>;
  timestamp: Date;
}

/**
 * Queue job data
 */
export interface QueueJobData {
  uploadId: string;
  chunkId?: string;
  priority: number;
  attempt: number;
  data: any;
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
  workerId: string;
  status: 'idle' | 'busy' | 'error';
  currentJob?: string;
  jobsProcessed: number;
  jobsFailed: number;
  avgProcessingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastHeartbeat: Date;
}

/**
 * System metrics
 */
export interface SystemMetrics {
  timestamp: Date;
  
  // Queue metrics
  queueLength: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  
  // Performance
  avgProcessingTime: number;
  throughputRowsPerSecond: number;
  
  // Resources
  memoryUsageMb: number;
  cpuUsagePercent: number;
  diskUsageGb: number;
  
  // Database
  dbConnections: number;
  dbResponseTimeMs: number;
  
  // Redis
  redisConnections: number;
  redisMemoryMb: number;
  redisOps: number;
}

/**
 * Configuration for upload processing
 */
export interface UploadConfig {
  // Limits
  maxFileSize: number;
  maxRowsPerChunk: number;
  maxConcurrentChunks: number;
  maxRetries: number;
  
  // Timeouts
  chunkTimeout: number;
  jobTimeout: number;
  
  // Performance
  streamHighWaterMark: number;
  batchSize: number;
  parallelism: number;
  
  // Features
  enableDeduplication: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  enableAuditLog: boolean;
  
  // Storage
  useS3: boolean;
  s3Bucket?: string;
  s3Region?: string;
}

/**
 * Business entities (actual data being uploaded)
 */
export interface InvoiceRow {
  invoiceNo: string;
  invoiceDate: string;
  month: string;
  year: string;
  salesmanName: string;
  storeName: string;
  storeCode: string;
  itemName: string;
  batchNo: string;
  quantity: number;
  rate: number;
  mrp: number;
  dis: number;
  amount: number;
  companyName: string;
  division: string;
  hq: string;
  expiryDate?: string;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  version: string;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
    transform?: (value: any) => any;
    validate?: (value: any, row: any) => boolean | string;
  }>;
}