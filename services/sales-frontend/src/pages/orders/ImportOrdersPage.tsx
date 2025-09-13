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
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  TableChart as TableChartIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiGatewayClient from '../../services/api-gateway-client';
import axios from 'axios';

interface UploadResult {
  success: boolean;
  message: string;
  processedCount?: number;
  failedCount?: number;
  errors?: string[];
}

const ImportOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(file.type) && !['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
        showSnackbar('Invalid file type. Please upload a CSV or Excel file.', 'error');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showSnackbar('File size exceeds 5MB limit.', 'error');
        return;
      }

      setSelectedFile(file);
      setUploadResult(null);
      showSnackbar(`File selected: ${file.name}`, 'info');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showSnackbar('Please select a file to upload', 'warning');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'orders');

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload the file using axios directly for multipart/form-data
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.REACT_APP_API_GATEWAY_URL || 'http://localhost:3015';
      
      const response = await axios.post(`${apiUrl}/api/orders/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.data.success) {
        const result: UploadResult = {
          success: true,
          message: response.data.message || 'File uploaded successfully',
          processedCount: response.data.processedCount || 0,
          failedCount: response.data.failedCount || 0,
          errors: response.data.errors || [],
        };
        
        setUploadResult(result);
        showSnackbar(
          `Successfully processed ${result.processedCount} orders${result.failedCount ? `, ${result.failedCount} failed` : ''}`,
          result.failedCount ? 'warning' : 'success'
        );

        // Clear file selection after successful upload
        setSelectedFile(null);
        const fileInput = document.getElementById('csv-upload-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Redirect to dashboard after 3 seconds if fully successful
        if (!result.failedCount) {
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadResult({
        success: false,
        message: error.message || 'Failed to upload file',
      });
      showSnackbar(error.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `order_number,store_id,customer_name,customer_phone,customer_email,product_name,quantity,unit_price,total_amount,notes
ORD-001,4261931000001048015,John Doe,+1-555-123-4567,john@example.com,Samosa,100,12,1200,Bulk order for event
ORD-001,4261931000001048015,John Doe,+1-555-123-4567,john@example.com,Chai,50,15,750,Bulk order for event
ORD-002,4261931000001048015,Jane Smith,+1-555-987-6543,jane@example.com,Bhel Puri,25,20,500,Regular order
ORD-003,4261931000001048016,Bob Johnson,+1-555-555-5555,bob@example.com,Pani Puri,30,18,540,Weekend special`;

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_orders.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSnackbar('Sample CSV downloaded', 'success');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Import Orders from CSV/Excel
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Import multiple orders at once from CSV or Excel files. Each row should represent one order item.
      </Typography>

      {uploadResult && (
        <Alert 
          severity={uploadResult.success ? 'success' : 'error'} 
          sx={{ mb: 3 }}
          action={
            uploadResult.success && !uploadResult.failedCount && (
              <Button color="inherit" size="small" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            )
          }
        >
          <Typography variant="subtitle2">{uploadResult.message}</Typography>
          {uploadResult.processedCount !== undefined && (
            <Typography variant="body2">
              Processed: {uploadResult.processedCount} orders
            </Typography>
          )}
          {uploadResult.failedCount !== undefined && uploadResult.failedCount > 0 && (
            <Typography variant="body2">
              Failed: {uploadResult.failedCount} orders
            </Typography>
          )}
          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption">Errors:</Typography>
              {uploadResult.errors.slice(0, 3).map((error, index) => (
                <Typography key={index} variant="caption" display="block">
                  • {error}
                </Typography>
              ))}
              {uploadResult.errors.length > 3 && (
                <Typography variant="caption" display="block">
                  ... and {uploadResult.errors.length - 3} more errors
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload File
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <input
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  id="csv-upload-input"
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <label htmlFor="csv-upload-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    size="large"
                    fullWidth
                    sx={{ p: 3, borderStyle: 'dashed' }}
                    disabled={uploading}
                  >
                    {selectedFile ? selectedFile.name : 'Choose CSV/Excel File'}
                  </Button>
                </label>
              </Box>

              {selectedFile && (
                <Box sx={{ mb: 3 }}>
                  <Chip
                    icon={<TableChartIcon />}
                    label={`${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`}
                    onDelete={() => {
                      setSelectedFile(null);
                      setUploadResult(null);
                    }}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}

              {uploading && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Uploading and processing...
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  startIcon={uploading ? null : <CloudUploadIcon />}
                  size="large"
                >
                  {uploading ? 'Processing...' : 'Upload & Process'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/dashboard')}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Format Requirements
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Supported Formats"
                    secondary="CSV (.csv), Excel (.xlsx, .xls)"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Max File Size"
                    secondary="5 MB"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <WarningIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Required Columns"
                    secondary="order_number, store_id, customer_name, product_name, quantity, unit_price"
                  />
                </ListItem>
              </List>

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadSampleCSV}
                  size="small"
                  fullWidth
                >
                  Download Sample CSV
                </Button>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Tips for successful import:
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                  • Ensure all required columns are present<br/>
                  • Use valid store IDs from your system<br/>
                  • Format phone numbers consistently<br/>
                  • Group items by order_number for multi-item orders<br/>
                  • Check for duplicate order numbers
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ImportOrdersPage;