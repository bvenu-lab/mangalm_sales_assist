const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function importCSV() {
  try {
    const csvPath = 'C:\\code\\mangalm\\user_journey\\Invoices_Mangalam .csv';
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found:', csvPath);
      return;
    }
    
    console.log('Importing CSV from:', csvPath);
    
    const response = await axios.post(
      'http://localhost:3007/api/orders/import-local',
      { csvPath },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    console.log('Import successful:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

importCSV();