# Scan-to-Order Feature Implementation Plan
## Mangalm Sales Assistant - Document Processing & Order Automation

---

## Executive Summary

This document outlines the comprehensive implementation strategy for adding scan-to-order capabilities to the Mangalm Sales Assistant platform. The feature will enable users to upload various formats of order documents (PDFs, scanned images, photos, handwritten forms) and automatically convert them into digital order forms with confidence scoring for extracted data.

### Key Objectives
- Enable document upload functionality across multiple formats with mandatory store selection
- Implement intelligent OCR with computer vision for data extraction
- Support varying document quality levels (poor scans, handwritten, mixed content)
- Provide confidence scoring for extracted information
- Map all uploaded documents to existing stores (no new store creation)
- Integrate seamlessly with existing store order management system

---

## 1. Technical Architecture

### 1.1 Document Processing Pipeline

```
[Upload] → [Pre-processing] → [Document Classification] → [OCR/Vision Processing] → [Data Extraction] → [Validation] → [Order Form Generation]
```

### 1.2 Technology Stack

#### Core Technologies
- **Frontend**: React with file upload components (react-dropzone)
- **Backend**: Node.js/Express microservice for document processing
- **OCR Engine**: Tesseract.js for browser-based OCR / Google Cloud Vision API for advanced recognition
- **Computer Vision**: OpenCV.js for image preprocessing
- **PDF Processing**: PDF.js for PDF parsing and rendering
- **Machine Learning**: TensorFlow.js for document classification and field detection

#### Supporting Libraries
- **Image Processing**: Sharp for server-side image manipulation
- **Form Detection**: Hough Transform for line/table detection
- **Handwriting Recognition**: Azure Cognitive Services or AWS Textract for handwritten text
- **Data Validation**: Joi for schema validation of extracted data

### 1.3 Microservice Architecture

```
sales-document-processor/
├── src/
│   ├── controllers/
│   │   ├── uploadController.js
│   │   └── processingController.js
│   ├── services/
│   │   ├── documentClassifier.js
│   │   ├── ocrService.js
│   │   ├── visionService.js
│   │   ├── dataExtractor.js
│   │   └── confidenceScorer.js
│   ├── processors/
│   │   ├── pdfProcessor.js
│   │   ├── imageProcessor.js
│   │   └── handwritingProcessor.js
│   └── models/
│       ├── orderDocument.js
│       └── extractedData.js
```

---

## 2. Feature Components

### 2.1 Document Upload Interface

#### Store Detail Page Integration
```javascript
// Location: services/sales-frontend/src/pages/stores/StoreDetailPage.tsx
// New component: DocumentUploadButton

Features:
- Drag-and-drop zone for files
- Store context automatically set (uploads mapped to current store)
- Multi-file upload support
- Progress indicators
- File type validation (PDF, JPG, PNG, JPEG)
- Maximum file size: 10MB per file
- Batch upload capability
```

#### Dashboard Integration
```javascript
// Location: services/sales-frontend/src/pages/dashboard/DashboardPage.tsx
// New component: BulkUploadWidget

Features:
- MANDATORY store selection dropdown before upload
- Bulk document processing with store mapping
- Queue management per store
- Processing status dashboard
- Error handling and retry mechanism
- Validation that store exists before upload
```

### 2.2 Document Classification System

#### Classification Categories
1. **Printed Forms** - Clean, machine-generated text
2. **Mixed Forms** - Printed with handwritten annotations
3. **Handwritten Forms** - Entirely handwritten documents
4. **Poor Quality Scans** - Low resolution, skewed, or damaged documents
5. **Photos** - Mobile camera captures with varying angles/lighting

#### Classification Logic
```javascript
classifyDocument(image) {
  // Analyze image characteristics
  - Resolution analysis
  - Text density detection
  - Handwriting vs print detection
  - Quality assessment (blur, noise, contrast)
  - Skew angle detection
  
  return {
    type: 'mixed|printed|handwritten|photo',
    quality: 'high|medium|low',
    preprocessing_needed: [],
    recommended_processor: 'tesseract|vision_api|handwriting_api'
  }
}
```

### 2.3 Image Preprocessing Pipeline

#### Preprocessing Operations
1. **Deskewing** - Correct document rotation
2. **Denoising** - Remove background noise
3. **Contrast Enhancement** - Improve text visibility
4. **Binarization** - Convert to black and white
5. **Border Removal** - Clean document edges
6. **Shadow Removal** - For photo captures

### 2.4 OCR and Data Extraction

#### Multi-Engine Approach
```javascript
// Adaptive OCR selection based on document type
const ocrEngines = {
  printed: {
    primary: 'tesseract',
    fallback: 'google_vision',
    settings: { language: 'eng', psm: 3 }
  },
  handwritten: {
    primary: 'azure_cognitive',
    fallback: 'aws_textract',
    settings: { mode: 'handwriting' }
  },
  mixed: {
    primary: 'google_vision',
    fallback: 'tesseract',
    settings: { mode: 'document_text' }
  }
}
```

#### Field Extraction Strategy
```javascript
// Pattern-based extraction for common fields
const extractionPatterns = {
  storeName: /Store\s*[:]\s*([^\n]+)/i,
  orderNumber: /Order\s*#?\s*[:]\s*(\d+)/i,
  date: /Date\s*[:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
  items: {
    pattern: /table|grid detection/,
    columns: ['item', 'quantity', 'price', 'total']
  },
  total: /Total\s*[:]\s*[$]?\s*([\d,]+\.?\d*)/i
}
```

### 2.5 Confidence Scoring System

#### Confidence Calculation
```javascript
calculateConfidence(extractedData) {
  const factors = {
    ocrConfidence: 0.3,      // OCR engine confidence
    patternMatch: 0.25,      // Regex pattern match strength
    dataValidation: 0.25,    // Business rule validation
    contextualScore: 0.2     // Contextual coherence
  };
  
  return {
    overall: weightedAverage(factors),
    fields: {
      storeName: 0.95,
      orderDate: 0.87,
      items: 0.78,
      total: 0.92
    }
  };
}
```

#### Confidence Levels
- **High (>85%)**: Auto-populate with green indicator
- **Medium (60-85%)**: Auto-populate with yellow indicator, suggest review
- **Low (<60%)**: Highlight for manual entry with red indicator

---

## 3. Database Schema

### 3.1 New Tables

```sql
-- Document uploads tracking
CREATE TABLE document_uploads (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT REFERENCES stores(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_status VARCHAR(50) DEFAULT 'pending',
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  error_message TEXT,
  created_by BIGINT REFERENCES users(id)
);

-- Extracted order data
CREATE TABLE extracted_orders (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES document_uploads(id),
  store_id BIGINT REFERENCES stores(id),
  extracted_data JSONB NOT NULL,
  confidence_scores JSONB NOT NULL,
  manual_corrections JSONB,
  converted_to_order BOOLEAN DEFAULT FALSE,
  order_id BIGINT REFERENCES orders(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing metrics
CREATE TABLE ocr_processing_metrics (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES document_uploads(id),
  document_type VARCHAR(50),
  quality_score DECIMAL(3,2),
  processing_time_ms INTEGER,
  ocr_engine_used VARCHAR(50),
  preprocessing_applied JSONB,
  extraction_accuracy DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Endpoints

### 4.1 Document Upload Endpoints

```javascript
// Upload single document
POST /api/documents/upload
Body: FormData { file, storeId?, metadata? }
Response: { documentId, status, processingQueue }

// Upload multiple documents
POST /api/documents/batch-upload
Body: FormData { files[], storeId?, metadata? }
Response: { documentIds[], status, processingQueue }

// Get upload status
GET /api/documents/{documentId}/status
Response: { status, progress, estimatedCompletion }
```

### 4.2 Processing Endpoints

```javascript
// Trigger document processing
POST /api/documents/{documentId}/process
Body: { priority?, options? }
Response: { processingId, queuePosition }

// Get processed results
GET /api/documents/{documentId}/results
Response: { 
  extractedData: {},
  confidenceScores: {},
  suggestedCorrections: []
}

// Submit manual corrections
POST /api/documents/{documentId}/corrections
Body: { corrections: {}, fields: [] }
Response: { updated: true, newConfidence: {} }
```

### 4.3 Order Generation Endpoints

```javascript
// Convert to order
POST /api/documents/{documentId}/convert-to-order
Body: { 
  storeId, 
  extractedData: {}, 
  manualOverrides: {} 
}
Response: { orderId, orderDetails, status }

// Preview order before creation
POST /api/documents/{documentId}/preview-order
Body: { extractedData: {} }
Response: { preview: {}, validationErrors: [] }
```

---

## 5. User Interface Design

### 5.1 Upload Component

```typescript
// Component structure
<DocumentUploadZone>
  <StoreSelector>
    - REQUIRED: Store selection dropdown
    - Search/filter stores
    - Validation before upload
    - Show selected store info
  </StoreSelector>
  
  <DropArea>
    - Drag & drop support
    - Click to browse
    - Paste from clipboard
  </DropArea>
  
  <FilePreview>
    - Thumbnail generation
    - File info display
    - Remove option
  </FilePreview>
  
  <ProcessingOptions>
    - Document type selection
    - Priority setting
    - Metadata entry
  </ProcessingOptions>
  
  <ActionButtons>
    - Upload & Process (disabled until store selected)
    - Save for Later
    - Cancel
  </ActionButtons>
</DocumentUploadZone>
```

### 5.2 Processing Status View

```typescript
<ProcessingDashboard>
  <QueueStatus>
    - Documents in queue
    - Average processing time
    - Completed today
  </QueueStatus>
  
  <ActiveProcessing>
    - Current document
    - Progress bar
    - Live preview
  </ActiveProcessing>
  
  <ProcessingHistory>
    - Recent uploads
    - Success/failure status
    - Retry options
  </ProcessingHistory>
</ProcessingDashboard>
```

### 5.3 Order Review Interface

```typescript
<OrderReviewPanel>
  <SplitView>
    <DocumentViewer>
      - Original document display
      - Zoom/pan controls
      - Highlight extracted regions
    </DocumentViewer>
    
    <ExtractedDataForm>
      <ConfidenceIndicators>
        - Field-level confidence bars
        - Color coding (green/yellow/red)
        - Tooltip explanations
      </ConfidenceIndicators>
      
      <EditableFields>
        - Store name [confidence: 95%]
        - Order date [confidence: 87%]
        - Items table [confidence: 78%]
        - Total amount [confidence: 92%]
      </EditableFields>
      
      <Actions>
        - Approve & Create Order
        - Request Re-processing
        - Save Draft
        - Discard
      </Actions>
    </ExtractedDataForm>
  </SplitView>
</OrderReviewPanel>
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up document-processor microservice
- [ ] Implement basic file upload functionality
- [ ] Create database schema and migrations
- [ ] Add upload UI to store detail page
- [ ] Basic PDF to text extraction

### Phase 2: Core OCR (Week 3-4)
- [ ] Integrate Tesseract.js for basic OCR
- [ ] Implement document classification system
- [ ] Add image preprocessing pipeline
- [ ] Create extraction patterns for common fields
- [ ] Build confidence scoring algorithm

### Phase 3: Advanced Processing (Week 5-6)
- [ ] Integrate cloud vision APIs (Google/Azure)
- [ ] Implement handwriting recognition
- [ ] Add table/grid detection for items
- [ ] Enhance preprocessing for poor quality images
- [ ] Build adaptive OCR selection logic

### Phase 4: User Interface (Week 7-8)
- [ ] Complete upload component with drag-drop
- [ ] Build processing status dashboard
- [ ] Create order review interface
- [ ] Add confidence indicators and editing
- [ ] Implement batch upload functionality

### Phase 5: Integration & Testing (Week 9-10)
- [ ] Connect to existing order management
- [ ] Add API gateway routes
- [ ] Comprehensive testing with sample documents
- [ ] Performance optimization
- [ ] Error handling and recovery

### Phase 6: Enhancement & Polish (Week 11-12)
- [ ] Machine learning model training for better extraction
- [ ] Add document template learning
- [ ] Implement user feedback loop
- [ ] Analytics and reporting
- [ ] Documentation and training materials

---

## 7. Testing Strategy

### 7.1 Test Document Categories

Using samples from `C:\code\mangalm\user_journey\orders`:
1. **Clean PDFs** - Mangalm Order Sheet.pdf
2. **Scanned Forms** - Microsoft Lens PDFs
3. **Phone Photos** - PHOTO-*.jpg files
4. **WhatsApp Images** - Variable quality mobile captures
5. **Mixed Content** - Printed with handwritten annotations

### 7.2 Test Scenarios

#### Functional Tests
- Upload single/multiple files
- Process different document types
- Extract data with varying confidence
- Manual correction workflow
- Order generation from extracted data

#### Performance Tests
- Large file processing (10MB limit)
- Batch processing (10+ documents)
- Concurrent user uploads
- OCR processing time benchmarks

#### Edge Cases
- Rotated/skewed documents
- Partially visible forms
- Non-English text handling
- Duplicate upload detection
- Network interruption recovery

### 7.3 Validation Metrics

```javascript
const validationMetrics = {
  accuracy: {
    target: 85,
    measure: 'correctly_extracted_fields / total_fields'
  },
  processingTime: {
    target: '< 30 seconds',
    measure: 'per document average'
  },
  userCorrections: {
    target: '< 20%',
    measure: 'fields requiring manual correction'
  },
  systemUptime: {
    target: '99.9%',
    measure: 'processing service availability'
  }
};
```

---

## 8. Security Considerations

### 8.1 File Upload Security
- File type validation (whitelist approach)
- File size limits (10MB max)
- Virus scanning integration
- Sandboxed processing environment
- Rate limiting per user/IP

### 8.2 Data Protection
- Encrypt documents at rest
- Secure transmission (HTTPS only)
- PII detection and masking
- Audit logging for all operations
- GDPR compliance for data retention

### 8.3 Access Control
- Role-based permissions for upload
- Store-level access restrictions
- Document ownership tracking
- Approval workflow for sensitive data

---

## 9. Performance Optimization

### 9.1 Processing Optimization
- Implement job queue with priority levels
- Parallel processing for batch uploads
- Caching for repeated documents
- Progressive rendering for large PDFs
- Lazy loading for document previews

### 9.2 Scalability Measures
- Horizontal scaling for processor service
- CDN for processed document storage
- Database indexing on frequently queried fields
- Redis caching for processing status
- Load balancing for OCR API calls

---

## 10. Cost Considerations

### 10.1 OCR API Pricing
- Google Cloud Vision: $1.50 per 1000 pages
- Azure Cognitive Services: $1.00 per 1000 pages
- AWS Textract: $1.50 per 1000 pages
- Implement intelligent routing to minimize costs

### 10.2 Storage Costs
- Document storage: ~$0.023 per GB/month
- Implement retention policies
- Compress processed documents
- Archive old documents to cold storage

---

## 11. Success Metrics

### 11.1 Key Performance Indicators
- **Adoption Rate**: % of stores using scan-to-order
- **Processing Accuracy**: % of correctly extracted fields
- **Time Savings**: Reduction in manual order entry time
- **Error Rate**: % of orders requiring correction
- **User Satisfaction**: NPS score for feature

### 11.2 Business Impact Metrics
- **Order Processing Speed**: 70% reduction in entry time
- **Data Entry Errors**: 90% reduction in manual errors
- **Customer Satisfaction**: Faster order turnaround
- **Operational Efficiency**: Staff time redirected to sales
- **Revenue Impact**: Increased order volume capacity

---

## 12. Risk Mitigation

### 12.1 Technical Risks
| Risk | Mitigation Strategy |
|------|-------------------|
| OCR accuracy issues | Multi-engine approach with fallbacks |
| Performance bottlenecks | Scalable architecture with queuing |
| API service outages | Local Tesseract.js fallback |
| Data loss | Regular backups, transaction logs |

### 12.2 Business Risks
| Risk | Mitigation Strategy |
|------|-------------------|
| User adoption resistance | Comprehensive training program |
| Incorrect order creation | Manual review for low confidence |
| Compliance issues | Legal review of data handling |
| Cost overruns | Usage monitoring and alerts |

---

## 13. Future Enhancements

### 13.1 Short-term (3-6 months)
- Mobile app integration for direct camera capture
- Template learning for frequent customers
- Barcode/QR code scanning support
- Multi-language OCR support
- Email attachment processing

### 13.2 Long-term (6-12 months)
- AI-powered form understanding
- Predictive field completion
- Integration with supplier systems
- Voice-to-order capabilities
- Blockchain verification for orders

---

## 14. Development Resources

### 14.1 Team Requirements
- **Backend Developer**: Node.js, OCR integration
- **Frontend Developer**: React, file upload UX
- **ML Engineer**: Document classification, extraction
- **QA Engineer**: Test automation, validation
- **DevOps**: Infrastructure, deployment

### 14.2 Timeline
- **Total Duration**: 12 weeks
- **Development**: 8 weeks
- **Testing**: 2 weeks
- **Deployment**: 1 week
- **Training**: 1 week

### 14.3 Dependencies
- Access to OCR API services
- Test document collection
- Storage infrastructure
- Processing servers/containers
- User training materials

---

## Appendix A: Sample Code Structures

### A.1 Document Upload Component
```typescript
// services/sales-frontend/src/components/DocumentUpload.tsx
interface DocumentUploadProps {
  storeId?: string;
  onUploadComplete: (documentId: string) => void;
  onError: (error: Error) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  storeId, 
  onUploadComplete, 
  onError 
}) => {
  // Implementation
};
```

### A.2 OCR Service Implementation
```javascript
// services/document-processor/src/services/ocrService.js
class OCRService {
  constructor() {
    this.engines = {
      tesseract: new TesseractEngine(),
      googleVision: new GoogleVisionEngine(),
      azure: new AzureEngine()
    };
  }
  
  async processDocument(document, options) {
    const classification = await this.classifyDocument(document);
    const engine = this.selectEngine(classification);
    const result = await engine.extract(document, options);
    return this.enhanceWithConfidence(result);
  }
}
```

### A.3 Confidence Scoring Algorithm
```javascript
// services/document-processor/src/services/confidenceScorer.js
class ConfidenceScorer {
  calculateFieldConfidence(field, value, context) {
    const factors = [
      this.ocrConfidence(field),
      this.patternMatchStrength(value, field.pattern),
      this.contextualCoherence(value, context),
      this.businessRuleValidation(value, field.rules)
    ];
    
    return this.weightedAverage(factors, field.weights);
  }
}
```

---

## Appendix B: Configuration Templates

### B.1 Environment Variables
```env
# Document Processor Service
OCR_TESSERACT_ENABLED=true
OCR_GOOGLE_VISION_API_KEY=xxx
OCR_AZURE_ENDPOINT=xxx
OCR_AZURE_KEY=xxx
MAX_FILE_SIZE_MB=10
PROCESSING_TIMEOUT_SECONDS=30
CONFIDENCE_THRESHOLD=0.60
```

### B.2 Docker Configuration
```dockerfile
# Dockerfile for document-processor service
FROM node:18-alpine
RUN apk add --no-cache python3 make g++ tesseract-ocr
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3010
CMD ["node", "src/server.js"]
```

---

## Document Version
- **Version**: 1.0.0
- **Date**: August 2025
- **Author**: Mangalm Sales Assistant Development Team
- **Status**: Planning Phase
- **Next Review**: Start of Phase 1 Implementation