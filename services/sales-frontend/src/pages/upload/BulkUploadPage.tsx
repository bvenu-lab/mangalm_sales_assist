import React, { useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  TableChart as TableChartIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

const BulkUploadPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3007';
      const token = localStorage.getItem('authToken');
      
      // Process each file
      let totalProcessed = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch(`${apiUrl}/api/orders/import`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          
          const result = await response.json();
          
          if (result.success) {
            totalProcessed += result.processedCount || 0;
            totalFailed += result.failedCount || 0;
            if (result.errors && result.errors.length > 0) {
              allErrors.push(...result.errors);
            }
            console.log(`File processed: ${result.message}`, result);
          } else {
            throw new Error(result.message || 'Import failed');
          }
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          allErrors.push(`${file.name}: ${fileError instanceof Error ? fileError.message : 'Upload failed'}`);
          totalFailed++;
        }
      }
      
      // Show results
      if (totalProcessed > 0) {
        setUploadSuccess(true);
        setSelectedFiles(null);
        
        // Build success message
        let message = `Successfully imported ${totalProcessed} order(s)`;
        if (totalFailed > 0) {
          message += `, ${totalFailed} failed`;
        }
        
        if (allErrors.length > 0) {
          setError(`${message}. Errors: ${allErrors.slice(0, 3).join('; ')}${allErrors.length > 3 ? '...' : ''}`);
        } else {
          // Clear success message after 5 seconds
          setTimeout(() => setUploadSuccess(false), 5000);
        }
      } else {
        throw new Error('Failed to import any orders');
      }
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `Invoice ID,Customer Name,Customer ID,Item Name,Quantity,Item Price,Total
INV-001,John Doe,4261931000001048015,Samosa,10,12,120
INV-001,John Doe,4261931000001048015,Chai,5,10,50
INV-002,Jane Smith,4261931000001048015,Bhel Puri,5,15,75
INV-002,Jane Smith,4261931000001048015,Pani Puri,10,12,120`;
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-orders.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Bulk Upload Orders
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Upload multiple orders at once using CSV or XLSX files. Each row should represent one order with the required columns.
      </Typography>

      {uploadSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Files uploaded successfully! The orders are being processed.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload Files
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <input
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  id="bulk-upload-files"
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                />
                <label htmlFor="bulk-upload-files">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    size="large"
                    fullWidth
                    sx={{ p: 3, borderStyle: 'dashed' }}
                  >
                    Choose CSV/XLSX Files
                  </Button>
                </label>
              </Box>

              {selectedFiles && selectedFiles.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Files:
                  </Typography>
                  {Array.from(selectedFiles).map((file, index) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </Typography>
                  ))}
                </Box>
              )}

              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFiles || selectedFiles.length === 0 || uploading}
                startIcon={<TableChartIcon />}
                size="large"
              >
                {uploading ? 'Uploading...' : 'Upload Orders'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Format
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Supported formats:</strong><br/>
                • CSV files (.csv)<br/>
                • Excel files (.xlsx, .xls)
              </Typography>

              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Supported columns (flexible names):</strong><br/>
                • Invoice ID / Order Number<br/>
                • Customer Name<br/>
                • Customer ID / Store ID<br/>
                • Item Name / Product Name<br/>
                • Quantity<br/>
                • Item Price / Unit Price<br/>
                • Total / SubTotal<br/>
                <br/>
                <em>Multiple items with the same Invoice ID will be grouped into one order.</em>
              </Typography>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadSampleCSV}
                size="small"
                fullWidth
              >
                Download Sample CSV
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BulkUploadPage;