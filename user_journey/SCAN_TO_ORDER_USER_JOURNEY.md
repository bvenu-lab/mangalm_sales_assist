# Scan-to-Order Feature User Journey

## Overview
The Scan-to-Order feature allows users to upload scanned documents, PDFs, or photos of order forms and have them automatically converted to digital orders. All uploaded documents MUST be associated with an existing store in the system.

## Key Principle
**No new stores are created through document upload.** Users must select which existing store the order documents belong to before uploading.

---

## User Journey 1: Upload from Store Detail Page

### Context
User is already viewing a specific store's detail page and wants to upload order documents for that store.

### Steps
1. **Navigate to Store**
   - User clicks on a store from the store list or dashboard
   - Opens the store detail page

2. **Access Upload Feature**
   - User clicks on "Scan Orders" tab
   - Upload interface appears with store context already set

3. **Upload Documents**
   - Drag and drop files OR click to browse
   - Files are automatically associated with the current store
   - No store selection needed (implicit from context)

4. **Review & Process**
   - View upload progress
   - Documents queued for processing
   - Stay on store page to view results

### Benefits
- Streamlined workflow when working with a specific store
- No need to select store (context-aware)
- Can immediately see uploaded documents in store's order history

---

## User Journey 2: Bulk Upload from Dashboard

### Context
User has multiple order documents from different stores and wants to process them in bulk.

### Steps
1. **Navigate to Dashboard**
   - User accesses main dashboard
   - Scrolls to "Bulk Order Document Upload" section

2. **Select Store FIRST (Required)**
   - **MANDATORY STEP**: Select store from dropdown
   - System shows all available stores
   - User can search/filter to find store
   - Upload button is DISABLED until store is selected

3. **Upload Documents**
   - After store selection, drag and drop files
   - All files will be associated with selected store
   - Can upload multiple files for same store

4. **Process Another Store**
   - To upload for different store, must:
     - Clear current files
     - Select new store from dropdown
     - Upload new set of files

5. **Monitor Processing**
   - View processing statistics
   - See queue status per store
   - Track success/failure rates

### Important Notes
- Cannot mix documents from different stores in single upload
- Must complete one store before moving to another
- System validates store exists before accepting upload

---

## User Journey 3: Handling Unknown Store Documents

### Scenario
User has order documents but is unsure which store they belong to.

### Resolution Steps
1. **Research First**
   - Check document for any store identifiers
   - Look for store name, address, or phone number
   - Cross-reference with store database

2. **Find Store in System**
   - Use store search feature
   - Filter by city, region, or name
   - Verify store details match document

3. **Then Upload**
   - Once store identified, proceed with upload
   - Select correct store from dropdown
   - Upload documents with confidence

### What NOT to Do
- ❌ Do NOT create a new store just for the document
- ❌ Do NOT upload to wrong store "temporarily"
- ❌ Do NOT skip store selection (system won't allow)

---

## Error Scenarios

### 1. No Store Selected
- **Error**: "Please select a store for these order documents"
- **Resolution**: Select store from dropdown before uploading

### 2. Store Not Found
- **Error**: "Selected store not found in system"
- **Resolution**: Verify store exists, may need to be added by admin first

### 3. Invalid File Type
- **Error**: "File type not supported"
- **Supported Types**: PDF, JPG, JPEG, PNG, TIFF, BMP
- **Resolution**: Convert file to supported format

### 4. File Too Large
- **Error**: "File exceeds 10MB limit"
- **Resolution**: Compress or split large files

---

## Best Practices

### For Sales Agents
1. **Organize by Store**: Keep documents sorted by store before uploading
2. **Verify Store**: Double-check store selection before upload
3. **Batch Processing**: Upload all documents for one store at once
4. **Quality Check**: Ensure documents are readable before upload

### For Managers
1. **Store Maintenance**: Ensure all active stores are in system
2. **Training**: Train staff on proper store selection
3. **Monitoring**: Review upload statistics by store
4. **Validation**: Periodically verify correct store associations

---

## Processing Flow After Upload

1. **Document Classification**
   - System determines if printed, handwritten, or mixed
   - Assesses document quality
   - Selects appropriate OCR engine

2. **Data Extraction**
   - Extracts order information
   - Identifies products and quantities
   - Calculates totals

3. **Confidence Scoring**
   - Each field gets confidence score
   - High confidence: Auto-populated
   - Low confidence: Flagged for review

4. **Order Creation**
   - Review extracted data
   - Make corrections if needed
   - Approve and create order for the store

---

## Security & Compliance

- All documents are associated with specific stores
- Audit trail maintained for uploads
- User permissions apply (can only upload to stores they have access to)
- Documents encrypted and stored securely
- Retention policies apply per store

---

## FAQ

**Q: Can I upload documents for multiple stores at once?**
A: No, you must select one store and upload its documents, then repeat for other stores.

**Q: What if the document doesn't show store name?**
A: You must identify the store through other means (invoice number, phone, address) before uploading.

**Q: Can I change store after uploading?**
A: No, once uploaded, documents are permanently associated with selected store. Upload carefully.

**Q: What happens to documents for closed stores?**
A: Closed stores should not appear in selection dropdown. Contact admin if you see closed stores.

**Q: Can I create a new store during upload?**
A: No, stores must be created through the store management interface by authorized users.

---

## Technical Notes

- Store validation happens server-side
- Documents are tagged with store_id in database
- Processing queue is store-specific
- Reports can be filtered by store
- Store association cannot be changed post-upload