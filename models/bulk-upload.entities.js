"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventType = exports.DeduplicationAction = exports.ErrorType = exports.ProcessingStrategy = exports.FileType = exports.ChunkStatus = exports.UploadStatus = void 0;
var UploadStatus;
(function (UploadStatus) {
    UploadStatus["PENDING"] = "pending";
    UploadStatus["VALIDATING"] = "validating";
    UploadStatus["CHUNKING"] = "chunking";
    UploadStatus["PROCESSING"] = "processing";
    UploadStatus["COMPLETED"] = "completed";
    UploadStatus["FAILED"] = "failed";
    UploadStatus["CANCELLED"] = "cancelled";
    UploadStatus["PARTIALLY_COMPLETED"] = "partially_completed";
})(UploadStatus || (exports.UploadStatus = UploadStatus = {}));
var ChunkStatus;
(function (ChunkStatus) {
    ChunkStatus["PENDING"] = "pending";
    ChunkStatus["PROCESSING"] = "processing";
    ChunkStatus["COMPLETED"] = "completed";
    ChunkStatus["FAILED"] = "failed";
    ChunkStatus["RETRYING"] = "retrying";
})(ChunkStatus || (exports.ChunkStatus = ChunkStatus = {}));
var FileType;
(function (FileType) {
    FileType["CSV"] = "csv";
    FileType["EXCEL"] = "excel";
    FileType["JSON"] = "json";
    FileType["XML"] = "xml";
})(FileType || (exports.FileType = FileType = {}));
var ProcessingStrategy;
(function (ProcessingStrategy) {
    ProcessingStrategy["STREAM"] = "stream";
    ProcessingStrategy["BATCH"] = "batch";
    ProcessingStrategy["PARALLEL"] = "parallel";
    ProcessingStrategy["SEQUENTIAL"] = "sequential";
})(ProcessingStrategy || (exports.ProcessingStrategy = ProcessingStrategy = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "validation";
    ErrorType["PARSING"] = "parsing";
    ErrorType["BUSINESS_LOGIC"] = "business_logic";
    ErrorType["DATABASE"] = "database";
    ErrorType["DUPLICATE"] = "duplicate";
    ErrorType["CONSTRAINT_VIOLATION"] = "constraint_violation";
    ErrorType["TIMEOUT"] = "timeout";
    ErrorType["SYSTEM"] = "system";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
var DeduplicationAction;
(function (DeduplicationAction) {
    DeduplicationAction["SKIP"] = "skip";
    DeduplicationAction["UPDATE"] = "update";
    DeduplicationAction["MERGE"] = "merge";
    DeduplicationAction["APPEND"] = "append";
    DeduplicationAction["REPLACE"] = "replace";
})(DeduplicationAction || (exports.DeduplicationAction = DeduplicationAction = {}));
var AuditEventType;
(function (AuditEventType) {
    AuditEventType["UPLOAD_STARTED"] = "upload_started";
    AuditEventType["UPLOAD_VALIDATED"] = "upload_validated";
    AuditEventType["UPLOAD_CHUNKED"] = "upload_chunked";
    AuditEventType["CHUNK_PROCESSING_STARTED"] = "chunk_processing_started";
    AuditEventType["CHUNK_PROCESSING_COMPLETED"] = "chunk_processing_completed";
    AuditEventType["CHUNK_PROCESSING_FAILED"] = "chunk_processing_failed";
    AuditEventType["UPLOAD_COMPLETED"] = "upload_completed";
    AuditEventType["UPLOAD_FAILED"] = "upload_failed";
    AuditEventType["UPLOAD_CANCELLED"] = "upload_cancelled";
    AuditEventType["UPLOAD_RETRIED"] = "upload_retried";
    AuditEventType["DATA_EXPORTED"] = "data_exported";
    AuditEventType["ERROR_RESOLVED"] = "error_resolved";
})(AuditEventType || (exports.AuditEventType = AuditEventType = {}));
