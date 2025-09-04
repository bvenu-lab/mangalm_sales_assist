/**
 * Test Data Generator
 * Creates realistic CSV data for testing
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Generate sample invoice data
 */
function generateInvoiceRow(index) {
  const stores = ['Store A', 'Store B', 'Store C', 'Store D', 'Store E'];
  const products = ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5'];
  const salesmen = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'];
  
  const quantity = Math.floor(Math.random() * 100) + 1;
  const rate = parseFloat((Math.random() * 100 + 10).toFixed(2));
  const amount = parseFloat((quantity * rate).toFixed(2));
  
  return {
    'Invoice No': `INV-2024-${String(index).padStart(5, '0')}`,
    'Invoice Date': '2024-01-15',
    'Month': 'January',
    'Year': '2024',
    'Salesman Name': salesmen[index % salesmen.length],
    'Store Name': stores[index % stores.length],
    'Store Code': `ST00${(index % stores.length) + 1}`,
    'Item Name': products[index % products.length],
    'Batch No': `BATCH-${String(index).padStart(4, '0')}`,
    'Quantity': quantity,
    'Rate': rate,
    'MRP': parseFloat((rate * 1.2).toFixed(2)),
    'Dis': parseFloat((Math.random() * 10).toFixed(2)),
    'Amount': amount,
    'Company Name': 'Test Company Ltd',
    'Division': 'Sales',
    'HQ': 'Mumbai',
    'Expiry Date': '2025-12-31'
  };
}

/**
 * Generate CSV file with specified number of rows
 */
async function generateCSV(filePath, rowCount = 100) {
  const headers = [
    'Invoice No', 'Invoice Date', 'Month', 'Year', 'Salesman Name',
    'Store Name', 'Store Code', 'Item Name', 'Batch No',
    'Quantity', 'Rate', 'MRP', 'Dis', 'Amount',
    'Company Name', 'Division', 'HQ', 'Expiry Date'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  for (let i = 1; i <= rowCount; i++) {
    const row = generateInvoiceRow(i);
    const values = headers.map(header => {
      const value = row[header];
      // Quote strings that contain commas
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvContent += values.join(',') + '\n';
  }
  
  await fs.writeFile(filePath, csvContent);
  return filePath;
}

/**
 * Generate CSV with invalid data for testing validation
 */
async function generateInvalidCSV(filePath) {
  const csvContent = `Invoice No,Invoice Date,Month,Year,Salesman Name,Store Name,Store Code,Item Name,Batch No,Quantity,Rate,MRP,Dis,Amount,Company Name,Division,HQ,Expiry Date
,2024-01-15,January,2024,John Doe,Store A,ST001,Product 1,BATCH-001,10,50.00,60.00,5,500.00,Test Co,Sales,Mumbai,2025-12-31
INV-2024-00002,,January,2024,Jane Smith,Store B,ST002,Product 2,BATCH-002,20,30.00,36.00,3,600.00,Test Co,Sales,Mumbai,2025-12-31
INV-2024-00003,2024-01-15,January,2024,Bob Johnson,,ST003,Product 3,BATCH-003,invalid,40.00,48.00,4,1200.00,Test Co,Sales,Mumbai,2025-12-31
INV-2024-00004,invalid-date,January,2024,Alice Brown,Store D,ST004,,BATCH-004,-5,25.00,30.00,2,-125.00,Test Co,Sales,Mumbai,2025-12-31
`;
  
  await fs.writeFile(filePath, csvContent);
  return filePath;
}

/**
 * Generate large CSV for performance testing
 */
async function generateLargeCSV(filePath, rowCount = 10000) {
  const stream = require('fs').createWriteStream(filePath);
  
  const headers = [
    'Invoice No', 'Invoice Date', 'Month', 'Year', 'Salesman Name',
    'Store Name', 'Store Code', 'Item Name', 'Batch No',
    'Quantity', 'Rate', 'MRP', 'Dis', 'Amount',
    'Company Name', 'Division', 'HQ', 'Expiry Date'
  ];
  
  stream.write(headers.join(',') + '\n');
  
  return new Promise((resolve, reject) => {
    let written = 0;
    
    function write() {
      let ok = true;
      while (written < rowCount && ok) {
        written++;
        const row = generateInvoiceRow(written);
        const values = headers.map(h => row[h]);
        const line = values.join(',') + '\n';
        
        if (written === rowCount) {
          stream.write(line, (err) => {
            if (err) reject(err);
            else resolve(filePath);
          });
        } else {
          ok = stream.write(line);
        }
      }
      
      if (written < rowCount) {
        stream.once('drain', write);
      }
    }
    
    write();
  });
}

module.exports = {
  generateInvoiceRow,
  generateCSV,
  generateInvalidCSV,
  generateLargeCSV
};