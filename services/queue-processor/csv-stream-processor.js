/**
 * Real CSV Stream Processor
 * Replaces mock data with actual file streaming
 */

const { createReadStream } = require('fs');
const csv = require('csv-parser');
const { Transform } = require('stream');
const crypto = require('crypto');

/**
 * Process CSV file in chunks with real data
 */
async function processCSVChunk(filePath, uploadId, chunk, client) {
  return new Promise((resolve, reject) => {
    let currentRow = 0;
    let processedInChunk = 0;
    let successCount = 0;
    let failureCount = 0;
    let duplicateCount = 0;
    const errors = [];
    const batchSize = 100;
    let batch = [];
    
    const readStream = createReadStream(filePath);
    
    const processStream = new Transform({
      objectMode: true,
      async transform(row, encoding, callback) {
        try {
          currentRow++;
          
          // Skip rows before chunk start
          if (currentRow <= chunk.start_row) {
            callback();
            return;
          }
          
          // Stop after chunk end
          if (currentRow > chunk.end_row) {
            this.push(null); // End the stream
            callback();
            return;
          }
          
          processedInChunk++;
          
          // Validate row
          const validation = validateRow(row, currentRow);
          if (!validation.valid) {
            failureCount++;
            errors.push({
              rowNumber: currentRow,
              error: validation.error,
              data: row
            });
            callback();
            return;
          }
          
          // Check for duplicates
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
            if (process.env.FEATURE_DEDUPLICATION === 'true') {
              callback();
              return;
            }
          }
          
          // Transform and add to batch
          const transformed = transformRow(row);
          batch.push({ ...transformed, hash });
          
          // Process batch when full
          if (batch.length >= batchSize) {
            try {
              await processBatch(batch, client);
              successCount += batch.length;
              batch = [];
            } catch (error) {
              failureCount += batch.length;
              errors.push({
                rowNumber: currentRow,
                error: error.message,
                batchError: true
              });
              batch = [];
            }
          }
          
          callback();
        } catch (error) {
          failureCount++;
          errors.push({
            rowNumber: currentRow,
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
            errors.push({
              error: error.message,
              batchError: true,
              batchSize: batch.length
            });
          }
        }
        callback();
      }
    });
    
    // Pipeline: Read -> Parse CSV -> Process
    readStream
      .pipe(csv())
      .pipe(processStream)
      .on('finish', async () => {
        // Record errors if any
        if (errors.length > 0) {
          await recordErrors(uploadId, chunk.id, errors, client);
        }
        
        resolve({
          rowCount: processedInChunk,
          successCount,
          failureCount,
          duplicateCount,
          errors: errors.slice(0, 10) // Return first 10 errors
        });
      })
      .on('error', reject);
  });
}

/**
 * Validate row data with comprehensive rules
 */
function validateRow(row, rowNumber) {
  const errors = [];
  
  // Required fields
  const requiredFields = ['InvoiceNo', 'InvoiceDate', 'StoreName', 'ItemName'];
  for (const field of requiredFields) {
    if (!row[field] && !row[field.replace(/([A-Z])/g, ' $1').trim()]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Numeric validations
  const numericFields = ['Quantity', 'Rate', 'MRP', 'Amount'];
  for (const field of numericFields) {
    const value = row[field];
    if (value !== undefined && value !== '') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push(`Invalid numeric value for ${field}: ${value}`);
      } else if (field === 'Quantity' && num <= 0) {
        errors.push(`${field} must be positive: ${value}`);
      } else if (num < 0) {
        errors.push(`${field} cannot be negative: ${value}`);
      }
    }
  }
  
  // Date validation
  if (row.InvoiceDate || row['Invoice Date']) {
    const dateStr = row.InvoiceDate || row['Invoice Date'];
    const date = parseDate(dateStr);
    if (!date) {
      errors.push(`Invalid date format: ${dateStr}`);
    }
  }
  
  // Business rules
  if (row.Amount && row.Quantity && row.Rate) {
    const expectedAmount = parseFloat(row.Quantity) * parseFloat(row.Rate);
    const actualAmount = parseFloat(row.Amount);
    const difference = Math.abs(expectedAmount - actualAmount);
    
    if (difference > 0.01) { // Allow for rounding errors
      errors.push(`Amount mismatch: Expected ${expectedAmount.toFixed(2)}, got ${actualAmount}`);
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; ')
    };
  }
  
  return { valid: true };
}

/**
 * Transform row to database format
 */
function transformRow(row) {
  // Handle both CamelCase and Space-separated field names
  return {
    invoice_no: row.InvoiceNo || row['Invoice No'],
    invoice_date: parseDate(row.InvoiceDate || row['Invoice Date']),
    month: row.Month,
    year: parseInt(row.Year, 10) || new Date().getFullYear(),
    salesman_name: row.SalesmanName || row['Salesman Name'] || '',
    store_name: row.StoreName || row['Store Name'],
    store_code: row.StoreCode || row['Store Code'] || '',
    item_name: row.ItemName || row['Item Name'],
    batch_no: row.BatchNo || row['Batch No'] || '',
    quantity: parseFloat(row.Quantity) || 0,
    rate: parseFloat(row.Rate) || 0,
    mrp: parseFloat(row.MRP) || 0,
    discount: parseFloat(row.Dis || row.Discount || 0),
    amount: parseFloat(row.Amount) || 0,
    company_name: row.CompanyName || row['Company Name'] || '',
    division: row.Division || '',
    hq: row.HQ || row.Hq || '',
    expiry_date: parseDate(row.ExpiryDate || row['Expiry Date'])
  };
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Handle invalid strings
  if (typeof dateStr !== 'string' || dateStr.toLowerCase() === 'invalid') {
    return null;
  }
  
  // Try DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY formats first
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day, month, year;
    
    // Check if first part is year (YYYY-MM-DD)
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // Assume DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      
      // Handle 2-digit years
      if (year < 100) {
        year += (year < 50) ? 2000 : 1900;
      }
    }
    
    // Validate date values
    if (isNaN(day) || isNaN(month) || isNaN(year) ||
        day < 1 || day > 31 || month < 0 || month > 11) {
      return null;
    }
    
    const date = new Date(year, month, day);
    // Check if date is valid and matches input (prevents date overflow)
    if (!isNaN(date.getTime()) && 
        date.getDate() === day && 
        date.getMonth() === month && 
        date.getFullYear() === year) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try standard ISO format as last resort
  const date = new Date(dateStr);
  if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 3000) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Process batch of rows with transaction
 */
async function processBatch(batch, client) {
  if (batch.length === 0) return;
  
  // Build multi-row insert
  const values = [];
  const placeholders = [];
  const dedupValues = [];
  let paramIndex = 1;
  
  for (const row of batch) {
    const rowPlaceholders = [];
    
    // Main data values
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
      row.expiry_date,
      row.hash
    );
    
    for (let i = 0; i < 19; i++) {
      rowPlaceholders.push(`$${paramIndex++}`);
    }
    
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
    
    // Deduplication values
    dedupValues.push(row.hash);
    dedupValues.push(`${row.invoice_no}-${row.item_name}-${row.batch_no}`);
  }
  
  // Insert into historical_invoices table
  await client.query(`
    INSERT INTO historical_invoices (
      invoice_no, invoice_date, month, year, salesman_name,
      store_name, store_code, item_name, batch_no,
      quantity, rate, mrp, discount, amount,
      company_name, division, hq, expiry_date, hash
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (invoice_no, item_name, batch_no) 
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      rate = EXCLUDED.rate,
      amount = EXCLUDED.amount,
      updated_at = NOW()
  `, values);
  
  // Record deduplication hashes
  const dedupPlaceholders = [];
  for (let i = 0; i < batch.length; i++) {
    const idx = i * 2 + 1;
    dedupPlaceholders.push(`($${idx}, $${idx + 1}, NOW())`);
  }
  
  await client.query(`
    INSERT INTO bulk_upload.deduplication (
      record_hash, business_key, created_at
    ) VALUES ${dedupPlaceholders.join(', ')}
    ON CONFLICT (record_hash) DO NOTHING
  `, dedupValues);
}

/**
 * Record processing errors
 */
async function recordErrors(uploadId, chunkId, errors, client) {
  for (const error of errors.slice(0, 100)) { // Limit to 100 errors per chunk
    await client.query(`
      INSERT INTO bulk_upload.processing_errors (
        upload_id, chunk_id, row_number, error_type,
        error_message, raw_data, retryable, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      uploadId,
      chunkId,
      error.rowNumber || null,
      error.batchError ? 'BATCH' : 'VALIDATION',
      error.error,
      JSON.stringify(error.data || {}),
      false
    ]);
  }
}

module.exports = {
  processCSVChunk,
  validateRow,
  transformRow,
  parseDate,
  processBatch
};