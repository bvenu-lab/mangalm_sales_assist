const fs = require('fs');

// Generate a larger test CSV file
const headers = 'Invoice No,Invoice Date,Month,Year,Salesman Name,Store Name,Store Code,Item Name,Batch No,Quantity,Rate,MRP,Discount,Amount,Company Name,Division,HQ,Expiry Date\n';

let csvContent = headers;

const salesmen = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown', 'Charlie Davis'];
const stores = ['Store ABC', 'Store XYZ', 'Store DEF', 'Store GHI', 'Store JKL'];
const storeCodes = ['ST001', 'ST002', 'ST003', 'ST004', 'ST005'];
const products = ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5', 'Product 6', 'Product 7', 'Product 8'];
const companies = ['Company ABC', 'Company XYZ', 'Company DEF', 'Company GHI'];
const divisions = ['Division A', 'Division B', 'Division C', 'Division D'];
const hqs = ['North', 'South', 'East', 'West', 'Central'];

// Generate 1000 rows
for (let i = 1; i <= 1000; i++) {
    const invoiceNo = `INV${String(i).padStart(6, '0')}`;
    const date = new Date(2024, 0, 1 + Math.floor(i / 10));
    const dateStr = date.toISOString().split('T')[0];
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    
    // Each invoice has 2-5 items
    const itemCount = 2 + Math.floor(Math.random() * 4);
    for (let j = 0; j < itemCount; j++) {
        const salesman = salesmen[Math.floor(Math.random() * salesmen.length)];
        const storeIdx = Math.floor(Math.random() * stores.length);
        const store = stores[storeIdx];
        const storeCode = storeCodes[storeIdx];
        const product = products[Math.floor(Math.random() * products.length)];
        const batchNo = `BTH${String(i * 10 + j).padStart(6, '0')}`;
        const quantity = 1 + Math.floor(Math.random() * 50);
        const rate = 50 + Math.floor(Math.random() * 450);
        const mrp = rate * 1.2;
        const discount = Math.floor(Math.random() * 20);
        const amount = quantity * rate * (1 - discount / 100);
        const company = companies[Math.floor(Math.random() * companies.length)];
        const division = divisions[Math.floor(Math.random() * divisions.length)];
        const hq = hqs[Math.floor(Math.random() * hqs.length)];
        const expiryDate = new Date(2025 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), 1).toISOString().split('T')[0];
        
        csvContent += `${invoiceNo},${dateStr},${month},${year},${salesman},${store},${storeCode},${product},${batchNo},${quantity},${rate.toFixed(2)},${mrp.toFixed(2)},${discount},${amount.toFixed(2)},${company},${division},${hq},${expiryDate}\n`;
    }
}

fs.writeFileSync('test-large.csv', csvContent);
console.log('Generated test-large.csv with ~3000 rows');