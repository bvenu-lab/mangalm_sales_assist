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
      // TODO: Implement actual bulk upload API call
      console.log('Uploading files:', selectedFiles);
      
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setUploadSuccess(true);
      setSelectedFiles(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => setUploadSuccess(false), 5000);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `store_id,customer_name,customer_phone,customer_email,items,total_amount
4261931000001048015,John Doe,+1-555-123-4567,john@example.com,"[{""productName"": ""Samosa"", ""quantity"": 10, ""unitPrice"": 12, ""totalPrice"": 120}]",120.00
4261931000001048015,Jane Smith,+1-555-987-6543,jane@example.com,"[{""productName"": ""Bhel Puri"", ""quantity"": 5, ""unitPrice"": 15, ""totalPrice"": 75}]",75.00`;
    
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
                <strong>Required columns:</strong><br/>
                • store_id<br/>
                • customer_name<br/>
                • customer_phone<br/>
                • items (JSON format)<br/>
                • total_amount
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