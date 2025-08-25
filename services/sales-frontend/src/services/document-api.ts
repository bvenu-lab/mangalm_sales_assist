import axios, { AxiosProgressEvent } from 'axios';
import { getAuthToken } from './api';

const DOCUMENT_PROCESSOR_URL = process.env.REACT_APP_DOCUMENT_PROCESSOR_URL || 'http://localhost:3010';
const API_GATEWAY_URL = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3007';

// ALWAYS use API Gateway since document processor is not running
const BASE_URL = `${API_GATEWAY_URL}/api/documents`;

console.log('Document API Configuration:', {
  DOCUMENT_PROCESSOR_URL,
  API_GATEWAY_URL,
  BASE_URL,
  environment: process.env.NODE_ENV
});

export interface DocumentUploadResponse {
  success: boolean;
  data: {
    documentId: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    status: string;
    uploadedAt: string;
  };
  message: string;
}

export interface OCRProcessingRequest {
  documentId: string;
  storeId?: string;
  priority?: number;
  metadata?: any;
  correlationId?: string;
  engine?: 'tesseract' | 'easyocr' | 'paddleocr' | 'ensemble';
  language?: string;
  enablePostProcessing?: boolean;
  qualityThreshold?: number;
  enableFallback?: boolean;
  maxRetries?: number;
  enableCaching?: boolean;
  enableProfiling?: boolean;
}

export interface OCRProcessingResponse {
  success: boolean;
  message: string;
  data?: {
    ocrJobId: string;
    correlationId: string;
    estimatedProcessingTime?: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    
    // Results (when completed)
    extractedText?: string;
    structuredText?: string;
    confidence?: number;
    qualityScore?: number;
    corrections?: number;
    
    // Metadata
    processingTime?: number;
    engineUsed?: string;
    documentElements?: any[];
    errors?: any[];
    warnings?: any[];
    recommendations?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface BatchUploadResponse {
  success: boolean;
  data: {
    documents: Array<{
      documentId: string;
      fileName: string;
      originalName: string;
      fileSize: number;
      status: string;
      uploadedAt: string;
    }>;
    totalUploaded: number;
  };
  message: string;
}

export interface DocumentStatus {
  success: boolean;
  data: {
    documentId: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    uploadedAt: string;
    processingStartedAt?: string;
    processingCompletedAt?: string;
    processingTimeMs?: number;
    queuePosition?: number;
    errorMessage?: string;
    retryCount: number;
  };
}

export interface ClassificationResult {
  documentClass: string;
  quality: number;
  confidence: number;
  ocrEngine?: string;
  preprocessingApplied?: string[];
}

export interface DocumentProcessingResult {
  success: boolean;
  data: {
    document: {
      id: string;
      fileName: string;
      status: string;
      uploadedAt: string;
      processingStartedAt?: string;
      processingCompletedAt?: string;
      processingTimeMs?: number;
      errorMessage?: string;
      retryCount: number;
    };
    classification?: ClassificationResult;
    extractedData?: ExtractedOrderData;
    confidenceScores?: {
      overall: number;
      fields?: { [key: string]: number };
      factors?: { [key: string]: number };
    };
    validationErrors?: Array<{
      field: string;
      error: string;
      severity: 'error' | 'warning' | 'info';
    }>;
  };
}

export interface ExtractedOrderData {
  storeName?: string;
  storeId?: string;
  orderNumber?: string;
  orderDate?: Date | string;
  deliveryDate?: Date | string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: Array<{
    productId?: string;
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    unit?: string;
    notes?: string;
  }>;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
}

export interface ProcessingResult {
  success: boolean;
  data: {
    extractedData: ExtractedOrderData;
    confidenceScores: {
      overall: number;
      fields: { [key: string]: number };
    };
    suggestedCorrections: Array<{
      field: string;
      currentValue: any;
      suggestedValue: any;
      reason: string;
    }>;
    validationErrors?: Array<{
      field: string;
      error: string;
      severity: 'error' | 'warning' | 'info';
    }>;
  };
}

class DocumentAPI {
  private getHeaders() {
    const token = getAuthToken();
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async uploadDocument(
    formData: FormData,
    options?: {
      onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
      signal?: AbortSignal;
      timeout?: number;
    }
  ): Promise<DocumentUploadResponse> {
    const uploadUrl = `${BASE_URL}/upload`;
    
    console.log('Starting document upload:', {
      url: uploadUrl,
      baseURL: BASE_URL,
      formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
        key,
        value: value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value
      })),
      headers: this.getHeaders(),
      timeout: options?.timeout
    });

    try {
      const response = await axios.post(uploadUrl, formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          console.log('Upload progress:', {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0
          });
          options?.onUploadProgress?.(progressEvent);
        },
        signal: options?.signal,
        timeout: options?.timeout,
      });
      
      console.log('Upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Upload failed with detailed error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        response: axios.isAxiosError(error) ? error.response?.data : undefined,
        config: axios.isAxiosError(error) ? {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        } : undefined
      });
      throw error;
    }
  }

  async uploadMultiple(
    formData: FormData,
    options?: {
      onUploadProgress?: (progressEvent: AxiosProgressEvent) => void;
    }
  ): Promise<BatchUploadResponse> {
    const response = await axios.post(`${BASE_URL}/upload/batch`, formData, {
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options?.onUploadProgress,
    });
    return response.data;
  }

  async getDocumentStatus(documentId: string): Promise<DocumentStatus> {
    const response = await axios.get(`${BASE_URL}/documents/${documentId}/status`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getStoreDocuments(storeId: string): Promise<any> {
    const response = await axios.get(`${BASE_URL}/stores/${storeId}/documents`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getProcessedDocuments(): Promise<any> {
    const response = await axios.get(`${BASE_URL}/processed`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<any> {
    const response = await axios.delete(`${BASE_URL}/documents/${documentId}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getProcessingResult(documentId: string): Promise<ProcessingResult> {
    const response = await axios.get(`${BASE_URL}/documents/${documentId}/results`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getDocumentProcessingResult(documentId: string): Promise<DocumentProcessingResult> {
    const response = await axios.get(`${DOCUMENT_PROCESSOR_URL}/api/processing/documents/${documentId}/results`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getStoreProcessingResults(storeId: string, status?: string, limit?: number, offset?: number): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const response = await axios.get(`${DOCUMENT_PROCESSOR_URL}/api/processing/stores/${storeId}/results?${params}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async submitCorrections(documentId: string, corrections: any): Promise<any> {
    const response = await axios.post(
      `${BASE_URL}/documents/${documentId}/corrections`,
      corrections,
      {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  async convertToOrder(documentId: string, data: {
    storeId: string;
    extractedData: ExtractedOrderData;
    manualOverrides?: any;
  }): Promise<any> {
    const response = await axios.post(
      `${BASE_URL}/documents/${documentId}/convert-to-order`,
      data,
      {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  async previewOrder(documentId: string, extractedData: ExtractedOrderData): Promise<any> {
    const response = await axios.post(
      `${BASE_URL}/documents/${documentId}/preview-order`,
      { extractedData },
      {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  async getUploadStats(): Promise<any> {
    const response = await axios.get(`${BASE_URL}/stats`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async processDocument(documentId: string, priority?: number): Promise<any> {
    const response = await axios.post(
      `${BASE_URL}/documents/${documentId}/process`,
      { priority },
      {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  // OCR Processing Methods

  async startOCRProcessing(request: OCRProcessingRequest): Promise<OCRProcessingResponse> {
    try {
      console.log('Starting OCR processing:', request);
      
      const response = await axios.post(
        `${BASE_URL}/ocr/process`,
        request,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
            'x-correlation-id': request.correlationId || this.generateCorrelationId()
          },
          timeout: 30000 // 30 seconds for starting OCR
        }
      );

      console.log('OCR processing started:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to start OCR processing:', error);
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async getOCRJobStatus(jobId: string): Promise<OCRProcessingResponse> {
    try {
      const response = await axios.get(
        `${BASE_URL}/ocr/jobs/${jobId}`,
        {
          headers: this.getHeaders(),
          timeout: 10000 // 10 seconds for status check
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get OCR job status:', error);
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async cancelOCRJob(jobId: string): Promise<OCRProcessingResponse> {
    try {
      const response = await axios.delete(
        `${BASE_URL}/ocr/jobs/${jobId}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to cancel OCR job:', error);
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async getOCRHealth(): Promise<any> {
    try {
      const response = await axios.get(
        `${BASE_URL}/ocr/health`,
        {
          headers: this.getHeaders(),
          timeout: 5000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get OCR health:', error);
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  private generateCorrelationId(): string {
    return `frontend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const documentApi = new DocumentAPI();