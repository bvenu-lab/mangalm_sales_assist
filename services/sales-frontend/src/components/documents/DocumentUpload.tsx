import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  AlertTitle,
  Collapse,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Upload as UploadIcon,
  TextFields as TextFieldsIcon,
  Psychology as PsychologyIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { documentApi } from '../../services/document-api';
import { debounce } from 'lodash';
import CryptoJS from 'crypto-js';

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'validating' | 'duplicate' | 'processing_ocr' | 'ocr_complete';
  progress: number;
  error?: string;
  documentId?: string;
  preview?: string;
  checksum?: string;
  lastModified?: number;
  uploadStartTime?: number;
  uploadEndTime?: number;
  retryCount?: number;
  correlationId?: string;
  
  // OCR-related fields
  ocrJobId?: string;
  ocrStatus?: 'queued' | 'processing' | 'completed' | 'failed';
  ocrResults?: {
    extractedText?: string;
    structuredText?: string;
    confidence?: number;
    qualityScore?: number;
    corrections?: number;
    processingTime?: number;
    engineUsed?: string;
    documentElements?: Array<{
      type: string;
      content: string;
      confidence: number;
    }>;
    errors?: any[];
    warnings?: any[];
    recommendations?: string[];
  };
}

interface DocumentUploadProps {
  storeId?: string;
  requireStoreSelection?: boolean;
  stores?: Array<{ id: string; name: string }>;
  onUploadComplete?: (documentIds: string[]) => void;
  onUploadProgress?: (progress: { completed: number; total: number; currentFile?: string }) => void;
  onError?: (error: Error) => void;
  onValidationError?: (errors: ValidationError[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
  showPreview?: boolean;
  autoUpload?: boolean;
  enableDuplicateDetection?: boolean;
  enableVirusScanning?: boolean;
  chunkUpload?: boolean;
  retryAttempts?: number;
  uploadTimeout?: number;
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
  
  // OCR-related props
  enableOCR?: boolean;
  ocrEngine?: 'tesseract' | 'easyocr' | 'paddleocr' | 'ensemble';
  ocrLanguage?: string;
  enablePostProcessing?: boolean;
  ocrQualityThreshold?: number;
  onOCRComplete?: (fileId: string, results: any) => void;
  onOCRProgress?: (fileId: string, status: string) => void;
}

interface ValidationError {
  fileName: string;
  type: 'size' | 'type' | 'duplicate' | 'virus' | 'corrupt' | 'security';
  message: string;
  severity: 'error' | 'warning';
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  storeId: propStoreId,
  requireStoreSelection = false,
  stores = [],
  onUploadComplete,
  onUploadProgress,
  onError,
  onValidationError,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/bmp'],
  showPreview = true,
  autoUpload = false,
  enableDuplicateDetection = true,
  enableVirusScanning = false,
  chunkUpload = false,
  retryAttempts = 3,
  uploadTimeout = 300000, // 5 minutes
  compressionEnabled = true,
  encryptionEnabled = false,
  
  // OCR props
  enableOCR = true,
  ocrEngine = 'tesseract',
  ocrLanguage = 'eng',
  enablePostProcessing = true,
  ocrQualityThreshold = 0.7,
  onOCRComplete,
  onOCRProgress,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdOrders, setCreatedOrders] = useState<Array<{orderNumber: string, documentName: string}>>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [priority, setPriority] = useState(5);
  const [metadata, setMetadata] = useState('');
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(propStoreId || '');
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [uploadedChecksums, setUploadedChecksums] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [queuedUploads, setQueuedUploads] = useState<UploadFile[]>([]);
  
  // OCR state
  const [ocrPollingIntervals, setOcrPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [expandedOCRResults, setExpandedOCRResults] = useState<Set<string>>(new Set());
  const [selectedOCREngine, setSelectedOCREngine] = useState<string>(ocrEngine);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const uploadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Enterprise validation with comprehensive security checks
  const validateFile = async (file: File): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];
    
    // File type validation with MIME type verification
    if (!acceptedFileTypes.includes(file.type)) {
      const supportedExtensions = acceptedFileTypes.map(type => type.split('/')[1]).join(', ');
      errors.push({
        fileName: file.name,
        type: 'type',
        message: `File type not supported. Supported types: ${supportedExtensions}`,
        severity: 'error'
      });
    }
    
    // File size validation
    if (file.size > maxFileSize) {
      errors.push({
        fileName: file.name,
        type: 'size',
        message: `File size exceeds ${maxFileSize / (1024 * 1024)}MB limit`,
        severity: 'error'
      });
    }
    
    // File size minimum check
    if (file.size < 100) { // Less than 100 bytes is suspicious
      errors.push({
        fileName: file.name,
        type: 'size',
        message: 'File appears to be empty or corrupted',
        severity: 'error'
      });
    }
    
    // Security checks
    const fileName = file.name.toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.js'];
    if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
      errors.push({
        fileName: file.name,
        type: 'security',
        message: 'File type is not allowed for security reasons',
        severity: 'error'
      });
    }
    
    // File name validation
    if (fileName.length > 255) {
      errors.push({
        fileName: file.name,
        type: 'security',
        message: 'File name is too long',
        severity: 'error'
      });
    }
    
    // Check for suspicious file names
    const suspiciousPatterns = [/\.\./, /[<>:"|?*]/, /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i];
    if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
      errors.push({
        fileName: file.name,
        type: 'security',
        message: 'File name contains invalid characters or reserved names',
        severity: 'error'
      });
    }
    
    return errors;
  };

  const calculateFileChecksum = async (file: File): Promise<string> => {
    try {
      // Use browser's native SubtleCrypto API for security
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('Failed to calculate checksum, using fallback:', error);
      // Fallback to simpler hash based on file metadata
      return `${file.name}_${file.size}_${file.lastModified}`.replace(/[^a-zA-Z0-9]/g, '');
    }
  };
  
  const createFilePreview = (file: File): string | undefined => {
    if (file.type.startsWith('image/') && showPreview && file.size < 5 * 1024 * 1024) { // Only for images < 5MB
      return URL.createObjectURL(file);
    }
    return undefined;
  };
  
  const generateCorrelationId = (): string => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const processFiles = async (fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = [];
    const allErrors: ValidationError[] = [];
    
    // Limit files to process
    const filesToProcess = Array.from(fileList).slice(0, maxFiles - files.length);
    
    if (filesToProcess.length < fileList.length) {
      allErrors.push({
        fileName: 'Batch',
        type: 'size',
        message: `Only processing first ${filesToProcess.length} files. Maximum ${maxFiles} files allowed.`,
        severity: 'warning'
      });
    }

    for (const file of filesToProcess) {
      try {
        // Set file to validating status first
        const tempId = `${Date.now()}-${Math.random()}`;
        const uploadFile: UploadFile = {
          id: tempId,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'validating',
          progress: 0,
          lastModified: file.lastModified,
          correlationId: generateCorrelationId(),
          retryCount: 0
        };
        
        setFiles(prev => [...prev, uploadFile]);
        
        // Validate file
        const fileErrors = await validateFile(file);
        allErrors.push(...fileErrors);
        
        if (fileErrors.some(e => e.severity === 'error')) {
          // Update status to error
          setFiles(prev => prev.map(f => 
            f.id === tempId 
              ? { ...f, status: 'error', error: fileErrors.map(e => e.message).join('; ') }
              : f
          ));
          continue;
        }
        
        // Calculate checksum for duplicate detection
        let checksum: string | undefined;
        if (enableDuplicateDetection) {
          checksum = await calculateFileChecksum(file);
          
          if (uploadedChecksums.has(checksum)) {
            allErrors.push({
              fileName: file.name,
              type: 'duplicate',
              message: 'This file has already been uploaded',
              severity: 'warning'
            });
            
            setFiles(prev => prev.map(f => 
              f.id === tempId 
                ? { ...f, status: 'duplicate', error: 'Duplicate file detected' }
                : f
            ));
            continue;
          }
        }
        
        // Create preview
        const preview = createFilePreview(file);
        
        // Update file with validated status
        const validatedFile: UploadFile = {
          ...uploadFile,
          status: 'pending',
          checksum,
          preview
        };
        
        setFiles(prev => prev.map(f => 
          f.id === tempId ? validatedFile : f
        ));
        
        newFiles.push(validatedFile);
        
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        allErrors.push({
          fileName: file.name,
          type: 'corrupt',
          message: 'Failed to process file - it may be corrupted',
          severity: 'error'
        });
      }
    }

    // Handle validation errors
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      if (onValidationError) {
        onValidationError(allErrors);
      }
      
      const errorMessages = allErrors.map(e => `${e.fileName}: ${e.message}`);
      setErrorMessage(errorMessages.join('\n'));
      setShowError(true);
    }

    // Auto upload if enabled and there are valid files
    if (autoUpload && newFiles.length > 0) {
      await uploadFiles(newFiles);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files).catch(console.error);
    }
  }, [files.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files).catch(console.error);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const uploadFileWithRetry = async (uploadFile: UploadFile, attempt: number = 1): Promise<any> => {
    const controller = new AbortController();
    abortControllers.current.set(uploadFile.id, controller);
    
    console.log(`[Upload Attempt ${attempt}] Starting upload for ${uploadFile.name}`, {
      fileId: uploadFile.id,
      fileSize: uploadFile.size,
      fileType: uploadFile.type,
      checksum: uploadFile.checksum,
      correlationId: uploadFile.correlationId,
      attempt,
      maxRetries: retryAttempts
    });
    
    try {
      // Set upload timeout
      const timeoutId = setTimeout(() => {
        console.warn(`[Upload Timeout] Upload timed out for ${uploadFile.name} after ${uploadTimeout}ms`);
        controller.abort();
      }, uploadTimeout);
      uploadTimeouts.current.set(uploadFile.id, timeoutId);
      
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      
      const currentStoreId = selectedStoreId || propStoreId;
      if (currentStoreId) formData.append('storeId', currentStoreId);
      formData.append('priority', priority.toString());
      if (metadata) formData.append('metadata', metadata);
      if (uploadFile.correlationId) formData.append('correlationId', uploadFile.correlationId);
      if (uploadFile.checksum) formData.append('checksum', uploadFile.checksum);
      
      console.log(`[Upload Request] Sending request for ${uploadFile.name}`, {
        formDataKeys: Array.from(formData.keys()),
        hasFile: formData.has('file'),
        timeout: uploadTimeout
      });
      
      const response = await documentApi.uploadDocument(formData, {
        signal: controller.signal,
        timeout: uploadTimeout,
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total 
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          
          if (progress % 25 === 0 || progress === 100) {
            console.log(`[Upload Progress] ${uploadFile.name}: ${progress}%`);
          }
          
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, progress } : f
          ));
        }
      });
      
      // Clear timeout
      const existingTimeoutId = uploadTimeouts.current.get(uploadFile.id);
      if (existingTimeoutId) {
        clearTimeout(existingTimeoutId);
        uploadTimeouts.current.delete(uploadFile.id);
      }
      
      console.log(`[Upload Success] ${uploadFile.name} uploaded successfully`, response);
      return response;
      
    } catch (error: any) {
      // Clear timeout
      const existingTimeoutId = uploadTimeouts.current.get(uploadFile.id);
      if (existingTimeoutId) {
        clearTimeout(existingTimeoutId);
        uploadTimeouts.current.delete(uploadFile.id);
      }
      
      console.error(`[Upload Error] Attempt ${attempt} failed for ${uploadFile.name}`, {
        errorMessage: error.message,
        errorCode: error.code,
        errorResponse: error.response?.data,
        errorConfig: error.config ? {
          url: error.config.url,
          method: error.config.method,
          baseURL: error.config.baseURL
        } : undefined,
        isAborted: controller.signal.aborted
      });
      
      // Handle retry logic
      if (attempt < retryAttempts && !controller.signal.aborted) {
        console.warn(`[Upload Retry] Will retry upload for ${uploadFile.name} (attempt ${attempt + 1}/${retryAttempts})`);
        
        // Update retry count
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, retryCount: attempt }
            : f
        ));
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        
        return uploadFileWithRetry(uploadFile, attempt + 1);
      }
      
      throw error;
    } finally {
      abortControllers.current.delete(uploadFile.id);
    }
  };
  
  const uploadFiles = async (filesToUpload?: UploadFile[]) => {
    const uploadList = filesToUpload || files.filter(f => f.status === 'pending');
    
    if (uploadList.length === 0) {
      setErrorMessage('No files to upload');
      setShowError(true);
      return;
    }

    // Check if store is selected when required
    const storeId = selectedStoreId || propStoreId;
    if (requireStoreSelection && !storeId) {
      setErrorMessage('Please select a store for these order documents');
      setShowError(true);
      setShowStoreSelector(true);
      return;
    }
    
    // Check connection status
    if (connectionStatus === 'offline') {
      setQueuedUploads(prev => [...prev, ...uploadList]);
      setErrorMessage('Currently offline. Files will be uploaded when connection is restored.');
      setShowError(true);
      return;
    }

    setIsUploading(true);
    setShowSuccess(false);
    setShowError(false);

    const totalFiles = uploadList.length;
    let completedFiles = 0;
    const uploadedDocumentIds: string[] = [];
    const failedUploads: UploadFile[] = [];

    // Process uploads with concurrency control
    const concurrencyLimit = 3;
    const chunks = [];
    for (let i = 0; i < uploadList.length; i += concurrencyLimit) {
      chunks.push(uploadList.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const uploadPromises = chunk.map(async (uploadFile) => {
        try {
          // Update file status to uploading
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'uploading', uploadStartTime: Date.now() } 
              : f
          ));

          const response = await uploadFileWithRetry(uploadFile);

          // Update file status to success
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  status: 'success', 
                  progress: 100, 
                  documentId: response.data.documentId,
                  uploadEndTime: Date.now()
                }
              : f
          ));

          // Add checksum to uploaded set
          if (uploadFile.checksum) {
            setUploadedChecksums(prev => new Set([...prev, uploadFile.checksum!]));
          }

          uploadedDocumentIds.push(response.data.documentId);
          completedFiles++;
          
          // Update progress
          const progressPercent = (completedFiles / totalFiles) * 100;
          setUploadProgress(progressPercent);
          
          if (onUploadProgress) {
            onUploadProgress({
              completed: completedFiles,
              total: totalFiles,
              currentFile: uploadFile.name
            });
          }
          
          // Track order creation if it happened
          if (response.data.orderNumber) {
            console.log(`[Order Created] Order ${response.data.orderNumber} created from document ${uploadFile.name}`);
            setCreatedOrders(prev => [...prev, {
              orderNumber: response.data.orderNumber,
              documentName: uploadFile.name
            }]);
          }

          // Start OCR processing if enabled
          if (enableOCR) {
            const updatedFile = files.find(f => f.id === uploadFile.id);
            if (updatedFile) {
              startOCRProcessing(updatedFile);
            }
          }

        } catch (error: any) {
          console.error('Upload failed for file:', uploadFile.name, error);
          
          // Update file status to error
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  status: 'error', 
                  error: error.message || 'Upload failed',
                  uploadEndTime: Date.now()
                }
              : f
          ));
          
          failedUploads.push(uploadFile);
          
          if (onError) {
            onError(error);
          }
        }
      });

      await Promise.allSettled(uploadPromises);
    }

    setIsUploading(false);
    setUploadProgress(0);

    // Show results
    if (uploadedDocumentIds.length > 0) {
      setShowSuccess(true);
      
      // Build success message with order details
      if (createdOrders.length > 0) {
        const orderMessages = createdOrders.map(o => `Order ${o.orderNumber} from ${o.documentName}`).join('\n');
        setSuccessMessage(`Successfully uploaded ${uploadedDocumentIds.length} document(s) and created orders:\n${orderMessages}`);
      } else {
        setSuccessMessage(`Successfully uploaded ${uploadedDocumentIds.length} document(s)`);
      }
      
      // Keep success message visible for longer
      setTimeout(() => {
        // Don't auto-hide, let user close it manually
      }, 10000);
      
      if (onUploadComplete) {
        onUploadComplete(uploadedDocumentIds);
      }
    }
    
    if (failedUploads.length > 0) {
      const failedNames = failedUploads.map(f => f.name).join(', ');
      setErrorMessage(`Failed to upload: ${failedNames}`);
      setShowError(true);
    }
  };

  // OCR Processing Functions
  const startOCRProcessing = async (uploadFile: UploadFile) => {
    if (!enableOCR || !uploadFile.documentId) return;

    try {
      // Update file status to processing OCR
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'processing_ocr', ocrStatus: 'queued' }
          : f
      ));

      // Start OCR processing
      const ocrResponse = await documentApi.startOCRProcessing({
        documentId: uploadFile.documentId,
        storeId: selectedStoreId || propStoreId,
        engine: selectedOCREngine as any,
        language: ocrLanguage,
        enablePostProcessing,
        qualityThreshold: ocrQualityThreshold,
        correlationId: uploadFile.correlationId
      });

      if (ocrResponse.success) {
        // Update file with OCR job info
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                ocrJobId: ocrResponse.data?.ocrJobId,
                ocrStatus: ocrResponse.data?.status 
              }
            : f
        ));

        // Start polling for OCR status
        if (ocrResponse.data?.ocrJobId) {
          pollOCRStatus(uploadFile.id, ocrResponse.data.ocrJobId);
        }

        if (onOCRProgress) {
          onOCRProgress(uploadFile.id, 'started');
        }
      } else {
        throw new Error(ocrResponse.error?.message || 'Failed to start OCR processing');
      }

    } catch (error) {
      console.error('OCR processing failed to start:', error);
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'success', // Keep as success since upload worked
              ocrStatus: 'failed',
              error: `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          : f
      ));
    }
  };

  const pollOCRStatus = (fileId: string, ocrJobId: string) => {
    const interval = setInterval(async () => {
      try {
        const statusResponse = await documentApi.getOCRJobStatus(ocrJobId);
        
        if (statusResponse.success && statusResponse.data) {
          const status = statusResponse.data.status;
          
          // Update file OCR status
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, ocrStatus: status }
              : f
          ));

          if (onOCRProgress) {
            onOCRProgress(fileId, status);
          }

          // If completed or failed, stop polling and update results
          if (status === 'completed' || status === 'failed') {
            clearInterval(interval);
            setOcrPollingIntervals(prev => {
              const newMap = new Map(prev);
              newMap.delete(fileId);
              return newMap;
            });

            if (status === 'completed') {
              handleOCRComplete(fileId, statusResponse.data);
            } else {
              handleOCRFailed(fileId, statusResponse.error?.message || 'OCR processing failed');
            }
          }
        }

      } catch (error) {
        console.error('Failed to poll OCR status:', error);
        clearInterval(interval);
        setOcrPollingIntervals(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }
    }, 2000); // Poll every 2 seconds

    setOcrPollingIntervals(prev => new Map(prev.set(fileId, interval)));
  };

  const handleOCRComplete = (fileId: string, ocrData: any) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { 
            ...f, 
            status: 'ocr_complete',
            ocrStatus: 'completed',
            ocrResults: {
              extractedText: ocrData.extractedText,
              structuredText: ocrData.structuredText,
              confidence: ocrData.confidence,
              qualityScore: ocrData.qualityScore,
              corrections: ocrData.corrections,
              processingTime: ocrData.processingTime,
              engineUsed: ocrData.engineUsed,
              documentElements: ocrData.documentElements,
              errors: ocrData.errors,
              warnings: ocrData.warnings,
              recommendations: ocrData.recommendations
            }
          }
        : f
    ));

    if (onOCRComplete) {
      onOCRComplete(fileId, ocrData);
    }
  };

  const handleOCRFailed = (fileId: string, errorMessage: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { 
            ...f, 
            status: 'success', // Keep upload as success
            ocrStatus: 'failed',
            error: `OCR failed: ${errorMessage}`
          }
        : f
    ));
  };

  const toggleOCRResultsExpansion = (fileId: string) => {
    setExpandedOCRResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const clearAll = () => {
    // Cancel any ongoing uploads
    abortControllers.current.forEach(controller => {
      controller.abort();
    });
    abortControllers.current.clear();
    
    // Clear timeouts
    uploadTimeouts.current.forEach(timeout => {
      clearTimeout(timeout);
    });
    uploadTimeouts.current.clear();
    
    // Clear OCR polling intervals
    ocrPollingIntervals.forEach(interval => {
      clearInterval(interval);
    });
    setOcrPollingIntervals(new Map());
    
    // Revoke object URLs
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    
    setFiles([]);
    setQueuedUploads([]);
    setValidationErrors([]);
    setShowSuccess(false);
    setShowError(false);
    setUploadProgress(0);
    setExpandedOCRResults(new Set());
  };
  
  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('online');
      
      // Upload queued files when back online
      if (queuedUploads.length > 0) {
        setFiles(prev => [...prev, ...queuedUploads]);
        setQueuedUploads([]);
        if (autoUpload) {
          uploadFiles(queuedUploads);
        }
      }
    };
    
    const handleOffline = () => setConnectionStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queuedUploads, autoUpload]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAll();
    };
  }, []);

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <PdfIcon />;
    if (type.startsWith('image/')) return <ImageIcon />;
    return <FileIcon />;
  };

  const getStatusIcon = (file: UploadFile) => {
    const { status, error, retryCount, ocrStatus, ocrResults } = file;
    
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'processing_ocr':
        return (
          <Tooltip title={`Processing with OCR (${ocrStatus || 'queued'})`}>
            <Box display="flex" alignItems="center">
              <PsychologyIcon color="primary" />
              <LinearProgress variant="indeterminate" sx={{ width: 60, ml: 1 }} />
            </Box>
          </Tooltip>
        );
      case 'ocr_complete':
        const qualityColor = ocrResults?.qualityScore 
          ? ocrResults.qualityScore > 0.8 ? 'success' 
          : ocrResults.qualityScore > 0.6 ? 'warning' 
          : 'error'
          : 'primary';
        return (
          <Tooltip title={`OCR Complete - Quality: ${(ocrResults?.qualityScore || 0).toFixed(2)}`}>
            <Box display="flex" alignItems="center">
              <CheckCircleIcon color="success" />
              <AssessmentIcon color={qualityColor} sx={{ ml: 0.5 }} />
            </Box>
          </Tooltip>
        );
      case 'error':
        return (
          <Tooltip title={`${error}${retryCount ? ` (${retryCount} retries)` : ''}`}>
            <ErrorIcon color="error" />
          </Tooltip>
        );
      case 'uploading':
        return (
          <Tooltip title={retryCount ? `Uploading (retry ${retryCount})` : 'Uploading'}>
            <LinearProgress variant="indeterminate" sx={{ width: 100 }} />
          </Tooltip>
        );
      case 'validating':
        return (
          <Tooltip title="Validating file">
            <LinearProgress variant="indeterminate" sx={{ width: 100 }} />
          </Tooltip>
        );
      case 'duplicate':
        return (
          <Tooltip title="Duplicate file detected">
            <WarningIcon color="warning" />
          </Tooltip>
        );
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Box>
      {/* Store Selection (when required) */}
      {requireStoreSelection && !propStoreId && (
        <Box mb={3}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Store Selection Required</AlertTitle>
            Select the store that these order documents belong to before uploading.
          </Alert>
          <FormControl fullWidth required>
            <InputLabel>Select Store</InputLabel>
            <Select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              label="Select Store"
            >
              <MenuItem value="">
                <em>-- Select a Store --</em>
              </MenuItem>
              {stores.map(store => (
                <MenuItem key={store.id} value={store.id}>
                  {store.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Upload Area */}
      <Paper
        sx={{
          p: 3,
          border: isDragging ? '2px dashed #2196f3' : '2px dashed #ccc',
          borderRadius: 2,
          backgroundColor: isDragging ? 'rgba(33, 150, 243, 0.05)' : 'transparent',
          transition: 'all 0.3s',
          cursor: 'pointer',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Box textAlign="center">
          <CloudUploadIcon sx={{ fontSize: 48, color: isDragging ? '#2196f3' : '#999', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag & Drop Files Here
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            or click to browse
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Supported formats: PDF, JPG, PNG, TIFF, BMP (Max {maxFileSize / (1024 * 1024)}MB per file)
          </Typography>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </Paper>

      {/* File List */}
      {files.length > 0 && (
        <Box mt={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Files ({files.length}/{maxFiles})
            </Typography>
            <Box>
              <Button
                size="small"
                onClick={() => setShowMetadataDialog(true)}
                startIcon={<InfoIcon />}
                sx={{ mr: 1 }}
              >
                Options
              </Button>
              <Button
                size="small"
                color="error"
                onClick={clearAll}
                startIcon={<DeleteIcon />}
              >
                Clear All
              </Button>
            </Box>
          </Box>

          <List>
            {files.map(file => (
              <ListItem key={file.id} sx={{ bgcolor: 'background.paper', mb: 1, borderRadius: 1 }}>
                <Box mr={2}>{getFileIcon(file.type)}</Box>
                <ListItemText
                  primary={
                    <Box>
                      <Typography variant="body2">{file.name}</Typography>
                      {file.correlationId && (
                        <Typography variant="caption" color="textSecondary">
                          ID: {file.correlationId.slice(-8)}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {formatFileSize(file.size)}
                        {file.uploadStartTime && file.uploadEndTime && (
                          <> • {((file.uploadEndTime - file.uploadStartTime) / 1000).toFixed(1)}s</>
                        )}
                        {file.retryCount && file.retryCount > 0 && (
                          <> • {file.retryCount} retries</>
                        )}
                      </Typography>
                      {(file.status === 'uploading' || file.status === 'validating') && (
                        <LinearProgress 
                          variant={file.status === 'validating' ? 'indeterminate' : 'determinate'} 
                          value={file.progress} 
                          sx={{ mt: 1 }} 
                        />
                      )}
                      {file.status === 'error' && file.error && (
                        <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                          {file.error}
                        </Typography>
                      )}
                      
                      {/* OCR Results Display */}
                      {file.ocrResults && file.status === 'ocr_complete' && (
                        <Box sx={{ mt: 1 }}>
                          <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
                            <Chip
                              icon={<TextFieldsIcon />}
                              label={`OCR: ${(file.ocrResults.confidence || 0).toFixed(2)} confidence`}
                              size="small"
                              color={file.ocrResults.confidence && file.ocrResults.confidence > 0.8 ? 'success' : 'default'}
                              sx={{ mr: 1 }}
                            />
                            <Chip
                              icon={<AssessmentIcon />}
                              label={`Quality: ${(file.ocrResults.qualityScore || 0).toFixed(2)}`}
                              size="small"
                              color={file.ocrResults.qualityScore && file.ocrResults.qualityScore > 0.8 ? 'success' : 'warning'}
                              sx={{ mr: 1 }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => toggleOCRResultsExpansion(file.id)}
                            >
                              {expandedOCRResults.has(file.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Box>
                          
                          {expandedOCRResults.has(file.id) && (
                            <Card variant="outlined" sx={{ mt: 1, p: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                OCR Results
                              </Typography>
                              
                              {/* Metadata */}
                              <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                                <Chip label={`Engine: ${file.ocrResults.engineUsed}`} size="small" />
                                {file.ocrResults.corrections && (
                                  <Chip label={`${file.ocrResults.corrections} corrections`} size="small" />
                                )}
                                {file.ocrResults.processingTime && (
                                  <Chip label={`${(file.ocrResults.processingTime / 1000).toFixed(1)}s`} size="small" />
                                )}
                              </Box>
                              
                              {/* Extracted Text */}
                              {file.ocrResults.extractedText && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Extracted Text:
                                  </Typography>
                                  <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                      {file.ocrResults.extractedText}
                                    </Typography>
                                  </Paper>
                                </Box>
                              )}
                              
                              {/* Document Elements */}
                              {file.ocrResults.documentElements && file.ocrResults.documentElements.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Document Structure:
                                  </Typography>
                                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {file.ocrResults.documentElements.map((element, index) => (
                                      <Chip
                                        key={index}
                                        label={`${element.type}: ${element.confidence.toFixed(2)}`}
                                        size="small"
                                        variant="outlined"
                                        color={element.confidence > 0.8 ? 'success' : 'default'}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                              
                              {/* Warnings and Recommendations */}
                              {file.ocrResults.warnings && file.ocrResults.warnings.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                    Warnings:
                                  </Typography>
                                  {file.ocrResults.warnings.map((warning, index) => (
                                    <Typography key={index} variant="caption" color="warning.main" display="block">
                                      • {warning.message || warning}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                              
                              {file.ocrResults.recommendations && file.ocrResults.recommendations.length > 0 && (
                                <Box>
                                  <Typography variant="subtitle2" color="info.main" gutterBottom>
                                    Recommendations:
                                  </Typography>
                                  {file.ocrResults.recommendations.map((rec, index) => (
                                    <Typography key={index} variant="caption" color="info.main" display="block">
                                      • {rec}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Card>
                          )}
                        </Box>
                      )}
                      
                      {/* OCR Processing Status */}
                      {(file.status === 'processing_ocr' || file.ocrStatus === 'processing' || file.ocrStatus === 'queued') && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            icon={<PsychologyIcon />}
                            label={`OCR ${file.ocrStatus || 'processing'}...`}
                            size="small"
                            color="primary"
                          />
                        </Box>
                      )}
                      
                      {file.ocrStatus === 'failed' && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            icon={<ErrorIcon />}
                            label="OCR Failed"
                            size="small"
                            color="error"
                          />
                        </Box>
                      )}
                    </Box>
                  }
                />
                <Box mr={2}>{getStatusIcon(file)}</Box>
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                  >
                    <CloseIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          {/* Upload Button */}
          {!autoUpload && files.some(f => f.status === 'pending') && (
            <Box mt={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => uploadFiles()}
                disabled={isUploading}
                startIcon={<UploadIcon />}
              >
                Upload {files.filter(f => f.status === 'pending').length} File(s)
              </Button>
            </Box>
          )}

          {/* Overall Progress */}
          {isUploading && (
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                Uploading files...
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </Box>
      )}

      {/* Success Alert */}
      <Collapse in={showSuccess}>
        <Alert 
          severity="success" 
          sx={{ 
            mt: 2,
            '& .MuiAlert-message': {
              whiteSpace: 'pre-line'
            }
          }} 
          onClose={() => {
            setShowSuccess(false);
            setCreatedOrders([]);
            setSuccessMessage('');
          }}
        >
          <AlertTitle>Upload Successful!</AlertTitle>
          <Box>{successMessage || 'Files uploaded successfully and queued for processing'}</Box>
          {createdOrders.length > 0 && (
            <Box mt={1}>
              <Button 
                size="small" 
                variant="outlined" 
                color="success"
                onClick={() => window.location.reload()}
              >
                Refresh Dashboard to View Orders
              </Button>
            </Box>
          )}
        </Alert>
      </Collapse>

      {/* Error Alert */}
      <Collapse in={showError}>
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setShowError(false)}>
          <AlertTitle>Error</AlertTitle>
          <Box style={{ whiteSpace: 'pre-line' }}>{errorMessage}</Box>
        </Alert>
      </Collapse>

      {/* Metadata Dialog */}
      <Dialog open={showMetadataDialog} onClose={() => setShowMetadataDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Options</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Priority</InputLabel>
              <Select value={priority} onChange={(e) => setPriority(Number(e.target.value))} label="Priority">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                  <MenuItem key={p} value={p}>
                    {p} {p === 1 ? '(Lowest)' : p === 10 ? '(Highest)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {enableOCR && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>OCR Engine</InputLabel>
                <Select 
                  value={selectedOCREngine} 
                  onChange={(e) => setSelectedOCREngine(e.target.value)} 
                  label="OCR Engine"
                >
                  <MenuItem value="tesseract">Tesseract (Fast, Good for printed text)</MenuItem>
                  <MenuItem value="easyocr">EasyOCR (Good for multiple languages)</MenuItem>
                  <MenuItem value="paddleocr">PaddleOCR (Advanced, Good for complex layouts)</MenuItem>
                  <MenuItem value="ensemble">Ensemble (Best quality, slower)</MenuItem>
                </Select>
              </FormControl>
            )}
            
            <TextField
              fullWidth
              label="Metadata (JSON)"
              multiline
              rows={3}
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder='{"notes": "Rush order", "category": "wholesale"}'
              helperText="Optional JSON metadata for the documents"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMetadataDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentUpload;