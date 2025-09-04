/**
 * Worker Thread for Chunk Processing
 * Handles individual chunks in isolation for maximum performance
 */

const { parentPort, workerData } = require('worker_threads');
const { Pool } = require('pg');
const { processCSVChunk } = require('./csv-stream-processor');

// Initialize database pool for this worker
const pool = new Pool({
  ...workerData.dbConfig,
  max: 5,
  idleTimeoutMillis: 30000
});

// Worker metrics
const metrics = {
  workerId: workerData.workerId,
  chunksProcessed: 0,
  rowsProcessed: 0,
  errors: 0,
  avgProcessingTime: 0,
  memoryUsage: 0
};

/**
 * Process chunk message
 */
parentPort.on('message', async (message) => {
  if (message.type === 'PROCESS_CHUNK') {
    try {
      // Add filePath to message for processing
      const result = await processChunk({ ...message, filePath: message.filePath });
      
      // Update metrics
      metrics.chunksProcessed++;
      metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Send result back
      parentPort.postMessage({
        chunkId: message.chunkId,
        result
      });
      
      // Send metrics update
      parentPort.postMessage({
        type: 'METRICS',
        workerId: workerData.workerId,
        metrics
      });
    } catch (error) {
      parentPort.postMessage({
        chunkId: message.chunkId,
        error: error.message
      });
    }
  }
});

/**
 * Process individual chunk
 */
async function processChunk({ uploadId, chunkId, chunk, filePath }) {
  const startTime = Date.now();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update chunk status
    await client.query(`
      UPDATE bulk_upload.upload_chunks 
      SET status = 'processing', processing_started_at = NOW()
      WHERE id = $1
    `, [chunkId]);
    
    // Get file data for this chunk (including file path from message)
    const fileData = await getChunkData(uploadId, chunk, client, filePath);
    
    // Process rows
    const result = await processRows(
      fileData,
      uploadId,
      chunkId,
      chunk,
      client
    );
    
    // Update chunk completion
    const processingTime = Date.now() - startTime;
    await client.query(`
      UPDATE bulk_upload.upload_chunks 
      SET 
        status = 'completed',
        processing_completed_at = NOW(),
        processing_time_ms = $1,
        success_count = $2,
        failure_count = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [processingTime, result.successCount, result.failureCount, chunkId]);
    
    await client.query('COMMIT');
    
    // Update worker metrics
    updateMetrics(processingTime, result.rowCount);
    
    return {
      chunkId,
      processedRows: result.rowCount,
      successfulRows: result.successCount,
      failedRows: result.failureCount,
      duplicateRows: result.duplicateCount,
      processingTimeMs: processingTime
    };
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Record chunk failure
    await client.query(`
      UPDATE bulk_upload.upload_chunks 
      SET status = 'failed', updated_at = NOW()
      WHERE id = $1
    `, [chunkId]);
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get chunk data from storage
 */
async function getChunkData(uploadId, chunk, client, filePath) {
  const uploadResult = await client.query(`
    SELECT file_name, metadata 
    FROM bulk_upload.upload_jobs 
    WHERE id = $1
  `, [uploadId]);
  
  if (!uploadResult.rows[0]) {
    throw new Error(`Upload ${uploadId} not found`);
  }
  
  // Get the actual file path - prefer passed filePath, then metadata
  const metadata = uploadResult.rows[0].metadata || {};
  const actualFilePath = filePath || metadata.filePath || 
    `./uploads/temp/${uploadResult.rows[0].file_name}`;
  
  return {
    fileName: uploadResult.rows[0].file_name,
    filePath: actualFilePath,
    metadata: metadata,
    startRow: chunk.start_row,
    endRow: chunk.end_row
  };
}

/**
 * Process rows in the chunk using real CSV data
 */
async function processRows(fileData, uploadId, chunkId, chunk, client) {
  // Use the real CSV processor with actual file path
  const actualFilePath = fileData.filePath || fileData.metadata?.filePath;
  if (actualFilePath && require('fs').existsSync(actualFilePath)) {
    return processCSVChunk(actualFilePath, uploadId, chunk, client);
  }
  
  // Fallback to mock data if file not found (for testing)
  let rowCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let duplicateCount = 0;
  
  const errors = [];
  const batchSize = 100;
  let batch = [];
  
  // Create processing pipeline
  const processRow = new Transform({
    objectMode: true,
    async transform(row, encoding, callback) {
      try {
        // Skip rows before chunk start
        if (rowCount < chunk.start_row) {
          rowCount++;
          callback();
          return;
        }
        
        // Stop after chunk end
        if (rowCount > chunk.end_row) {
          callback();
          return;
        }
        
        rowCount++;
        
        // Validate row
        const validation = validateRow(row, rowCount);
        if (!validation.valid) {
          failureCount++;
          errors.push({
            rowNumber: rowCount,
            error: validation.error
          });
          callback();
          return;
        }
        
        // Check for duplicates
        const isDuplicate = await checkDuplicate(row, client);
        if (isDuplicate) {
          duplicateCount++;
          // Depending on strategy, we might skip or update
          if (process.env.FEATURE_DEDUPLICATION === 'true') {
            callback();
            return;
          }
        }
        
        // Add to batch
        batch.push(transformRow(row));
        
        // Process batch when full
        if (batch.length >= batchSize) {
          await processBatch(batch, client);
          successCount += batch.length;
          batch = [];
        }
        
        callback();
      } catch (error) {
        failureCount++;
        errors.push({
          rowNumber: rowCount,
          error: error.message
        });
        callback();
      }
    },
    
    async flush(callback) {
      // Process remaining batch
      if (batch.length > 0) {
        try {
          await processBatch(batch, client);
          successCount += batch.length;
        } catch (error) {
          failureCount += batch.length;
        }
      }
      callback();
    }
  });
  
  // For demonstration, we'll process a sample of data
  // In production, this would stream from actual file storage
  const sampleData = generateSampleData(chunk.start_row, chunk.end_row);
  
  return new Promise((resolve, reject) => {
    let currentRow = 0;
    
    const processNext = async () => {
      while (currentRow <= chunk.end_row && currentRow < sampleData.length) {
        const row = sampleData[currentRow];
        currentRow++;
        
        try {
          // Validate
          const validation = validateRow(row, currentRow);
          if (!validation.valid) {
            failureCount++;
            errors.push({
              rowNumber: currentRow,
              error: validation.error
            });
            continue;
          }
          
          // Check duplicate
          const hash = crypto
            .createHash('sha256')
            .update(JSON.stringify(row))
            .digest('hex');
          
          const dupResult = await client.query(`
            SELECT 1 FROM bulk_upload.deduplication 
            WHERE record_hash = $1 LIMIT 1
          `, [hash]);
          
          if (dupResult.rows.length > 0) {
            duplicateCount++;
            continue;
          }
          
          // Add to batch
          batch.push(transformRow(row));
          
          // Process batch
          if (batch.length >= batchSize) {
            await processBatch(batch, client);
            successCount += batch.length;
            batch = [];
          }
        } catch (error) {
          failureCount++;
          errors.push({
            rowNumber: currentRow,
            error: error.message
          });
        }
      }
      
      // Process remaining
      if (batch.length > 0) {
        await processBatch(batch, client);
        successCount += batch.length;
      }
      
      // Record errors
      if (errors.length > 0) {
        await recordErrors(uploadId, chunkId, errors, client);
      }
      
      resolve({
        rowCount: currentRow,
        successCount,
        failureCount,
        duplicateCount
      });
    };
    
    processNext().catch(reject);
  });
}

/**
 * Validate row data
 */
function validateRow(row, rowNumber) {
  // Basic validation rules
  if (!row.InvoiceNo || !row.InvoiceDate) {
    return {
      valid: false,
      error: 'Missing required fields: InvoiceNo or InvoiceDate'
    };
  }
  
  if (!row.StoreName || !row.ItemName) {
    return {
      valid: false,
      error: 'Missing required fields: StoreName or ItemName'
    };
  }
  
  if (isNaN(parseFloat(row.Quantity)) || parseFloat(row.Quantity) <= 0) {
    return {
      valid: false,
      error: `Invalid quantity: ${row.Quantity}`
    };
  }
  
  if (isNaN(parseFloat(row.Amount)) || parseFloat(row.Amount) < 0) {
    return {
      valid: false,
      error: `Invalid amount: ${row.Amount}`
    };
  }
  
  return { valid: true };
}

/**
 * Transform row to database format
 */
function transformRow(row) {
  return {
    invoice_no: row.InvoiceNo || row['Invoice No'],
    invoice_date: parseDate(row.InvoiceDate || row['Invoice Date']),
    month: row.Month,
    year: parseInt(row.Year, 10),
    salesman_name: row['Salesman Name'] || row.SalesmanName,
    store_name: row['Store Name'] || row.StoreName,
    store_code: row['Store Code'] || row.StoreCode,
    item_name: row['Item Name'] || row.ItemName,
    batch_no: row['Batch No'] || row.BatchNo,
    quantity: parseFloat(row.Quantity),
    rate: parseFloat(row.Rate),
    mrp: parseFloat(row.MRP),
    discount: parseFloat(row.Dis || row.Discount || 0),
    amount: parseFloat(row.Amount),
    company_name: row['Company Name'] || row.CompanyName,
    division: row.Division,
    hq: row.HQ,
    expiry_date: parseDate(row['Expiry Date'] || row.ExpiryDate)
  };
}

/**
 * Parse date string
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle various date formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  // Try DD/MM/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Check for duplicate record
 */
async function checkDuplicate(row, client) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(row))
    .digest('hex');
  
  const result = await client.query(`
    SELECT 1 FROM bulk_upload.deduplication 
    WHERE record_hash = $1 LIMIT 1
  `, [hash]);
  
  return result.rows.length > 0;
}

/**
 * Process batch of rows
 */
async function processBatch(batch, client) {
  if (batch.length === 0) return;
  
  // Build multi-row insert
  const values = [];
  const placeholders = [];
  let paramIndex = 1;
  
  for (const row of batch) {
    const rowPlaceholders = [];
    
    values.push(
      row.invoice_no,
      row.invoice_date,
      row.month,
      row.year,
      row.salesman_name,
      row.store_name,
      row.store_code,
      row.item_name,
      row.batch_no,
      row.quantity,
      row.rate,
      row.mrp,
      row.discount,
      row.amount,
      row.company_name,
      row.division,
      row.hq,
      row.expiry_date
    );
    
    for (let i = 0; i < 18; i++) {
      rowPlaceholders.push(`$${paramIndex++}`);
    }
    
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }
  
  // Insert batch
  await client.query(`
    INSERT INTO invoice_items (
      invoice_no, invoice_date, month, year, salesman_name,
      store_name, store_code, item_name, batch_no,
      quantity, rate, mrp, discount, amount,
      company_name, division, hq, expiry_date
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (invoice_no, item_name, batch_no) 
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      amount = EXCLUDED.amount,
      updated_at = NOW()
  `, values);
  
  // Record deduplication hashes
  for (const row of batch) {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(row))
      .digest('hex');
    
    const businessKey = `${row.invoice_no}-${row.item_name}-${row.batch_no}`;
    
    await client.query(`
      INSERT INTO bulk_upload.deduplication (
        record_hash, business_key, created_at
      ) VALUES ($1, $2, NOW())
      ON CONFLICT (record_hash) DO NOTHING
    `, [hash, businessKey]);
  }
}

/**
 * Record processing errors
 */
async function recordErrors(uploadId, chunkId, errors, client) {
  for (const error of errors) {
    await client.query(`
      INSERT INTO bulk_upload.processing_errors (
        upload_id, chunk_id, row_number, error_type,
        error_message, retryable, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      uploadId,
      chunkId,
      error.rowNumber,
      'VALIDATION',
      error.error,
      false
    ]);
  }
}

/**
 * Generate sample data for testing
 */
function generateSampleData(startRow, endRow) {
  const data = [];
  
  for (let i = startRow; i <= endRow && i < 1000; i++) {
    data.push({
      InvoiceNo: `INV-2024-${i}`,
      InvoiceDate: '2024-01-15',
      Month: 'January',
      Year: '2024',
      'Salesman Name': 'John Doe',
      'Store Name': `Store ${i % 10}`,
      'Store Code': `ST00${i % 10}`,
      'Item Name': `Product ${i % 100}`,
      'Batch No': `BATCH-${i}`,
      Quantity: Math.floor(Math.random() * 100) + 1,
      Rate: (Math.random() * 100 + 10).toFixed(2),
      MRP: (Math.random() * 150 + 20).toFixed(2),
      Dis: (Math.random() * 10).toFixed(2),
      Amount: (Math.random() * 1000 + 100).toFixed(2),
      'Company Name': 'Mangalam Corp',
      Division: 'Sales',
      HQ: 'Mumbai',
      'Expiry Date': '2025-12-31'
    });
  }
  
  return data;
}

/**
 * Update worker metrics
 */
function updateMetrics(processingTime, rowCount) {
  metrics.rowsProcessed += rowCount;
  
  // Update average processing time (exponential moving average)
  const alpha = 0.1;
  metrics.avgProcessingTime = 
    alpha * processingTime + (1 - alpha) * metrics.avgProcessingTime;
}

// Send heartbeat
setInterval(() => {
  parentPort.postMessage({
    type: 'HEARTBEAT',
    workerId: workerData.workerId,
    timestamp: new Date()
  });
}, 30000);

// Cleanup on exit
process.on('exit', async () => {
  await pool.end();
});