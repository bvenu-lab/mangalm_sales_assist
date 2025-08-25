import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Stack,
  Alert,
  AlertTitle,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  LinearProgress,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Scanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Description as DocumentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HourglassEmpty as ProcessingIcon,
  Psychology as AIIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  TextFields as TextFieldsIcon,
  Timeline as TimelineIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import DocumentUpload from '../../components/documents/DocumentUpload';
import apiGatewayClient from '../../services/api-gateway-client';
import { documentApi } from '../../services/document-api';
import { format } from 'date-fns';

interface ProcessedDocument {
  id: string;
  fileName: string;
  uploadDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  storeId: string;
  storeName: string;
  confidence: number;
  extractedData?: {
    orderNumber?: string;
    customerName?: string;
    totalAmount?: number;
    itemCount?: number;
    products?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  processingTime?: number;
  errors?: string[];
}

const DocumentProcessingPage: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadSection, setShowUploadSection] = useState(true);
  const [processingStats, setProcessingStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    avgProcessingTime: 0,
    avgConfidence: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storesRes, documentsRes] = await Promise.all([
        apiGatewayClient.get('/api/stores'),
        documentApi.getProcessedDocuments(),
      ]);

      setStores(storesRes.data || []);
      setDocuments(documentsRes.data || []);
      
      // Calculate stats
      const docs = documentsRes.data || [];
      const stats = {
        total: docs.length,
        completed: docs.filter((d: any) => d.status === 'completed').length,
        processing: docs.filter((d: any) => d.status === 'processing').length,
        failed: docs.filter((d: any) => d.status === 'failed').length,
        avgProcessingTime: docs
          .filter((d: any) => d.processingTime)
          .reduce((acc: number, d: any) => acc + d.processingTime, 0) / 
          (docs.filter((d: any) => d.processingTime).length || 1),
        avgConfidence: docs
          .filter((d: any) => d.confidence)
          .reduce((acc: number, d: any) => acc + d.confidence, 0) / 
          (docs.filter((d: any) => d.confidence).length || 1),
      };
      setProcessingStats(stats);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (documentIds: string[]) => {
    console.log('Documents uploaded:', documentIds);
    // Refresh the document list
    fetchData();
    // Show success notification
    setShowUploadSection(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'processing':
        return <ProcessingIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase().endsWith('.pdf')) {
      return <PdfIcon />;
    }
    if (fileName.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
      return <ImageIcon />;
    }
    return <DocumentIcon />;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesStore = selectedStore === 'all' || doc.storeId === selectedStore;
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.extractedData?.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.extractedData?.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStore && matchesSearch;
  });

  const tabContent = [
    { label: 'All Documents', count: documents.length },
    { label: 'Processing', count: processingStats.processing },
    { label: 'Completed', count: processingStats.completed },
    { label: 'Failed', count: processingStats.failed },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Document Processing Center
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload and process order documents with AI-powered extraction
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Documents Processed
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {processingStats.total}
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {processingStats.completed} completed
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light', width: 56, height: 56 }}>
                  <DocumentIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {processingStats.total > 0 
                      ? `${((processingStats.completed / processingStats.total) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {processingStats.failed} failed
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.light', width: 56, height: 56 }}>
                  <CheckCircleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Avg Processing Time
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {processingStats.avgProcessingTime.toFixed(1)}s
                  </Typography>
                  <Typography variant="caption" color="primary.main">
                    Per document
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.light', width: 56, height: 56 }}>
                  <SpeedIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Avg Confidence
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {(processingStats.avgConfidence * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    AI accuracy
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.light', width: 56, height: 56 }}>
                  <AIIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Section */}
      {showUploadSection && (
        <Card sx={{ mb: 4 }}>
          <CardHeader
            title={
              <Box display="flex" alignItems="center">
                <AutoAwesomeIcon sx={{ mr: 1 }} />
                Quick Upload
              </Box>
            }
            subheader="Drag & drop or click to upload order documents"
            action={
              <IconButton onClick={() => setShowUploadSection(false)}>
                <CloseIcon />
              </IconButton>
            }
          />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <DocumentUpload
                  requireStoreSelection={true}
                  stores={stores.map(s => ({ id: s.id, name: s.name }))}
                  onUploadComplete={handleUploadComplete}
                  maxFiles={10}
                  autoUpload={false}
                  enableOCR={true}
                  showPreview={true}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <Typography variant="h6" gutterBottom>
                    How it works
                  </Typography>
                  <Stepper orientation="vertical" activeStep={-1}>
                    <Step>
                      <StepLabel>Upload Document</StepLabel>
                      <StepContent>
                        <Typography variant="body2">
                          Select and upload order documents (PDF, JPG, PNG)
                        </Typography>
                      </StepContent>
                    </Step>
                    <Step>
                      <StepLabel>AI Processing</StepLabel>
                      <StepContent>
                        <Typography variant="body2">
                          Our AI extracts text and identifies order details
                        </Typography>
                      </StepContent>
                    </Step>
                    <Step>
                      <StepLabel>Data Extraction</StepLabel>
                      <StepContent>
                        <Typography variant="body2">
                          Products, quantities, and customer info are extracted
                        </Typography>
                      </StepContent>
                    </Step>
                    <Step>
                      <StepLabel>Order Creation</StepLabel>
                      <StepContent>
                        <Typography variant="body2">
                          Digital order is created and ready for processing
                        </Typography>
                      </StepContent>
                    </Step>
                  </Stepper>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Quick Upload Button (when section is hidden) */}
      {!showUploadSection && (
        <Box mb={3}>
          <Button
            variant="contained"
            size="large"
            startIcon={<CloudUploadIcon />}
            onClick={() => setShowUploadSection(true)}
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
            }}
          >
            Upload New Documents
          </Button>
        </Box>
      )}

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Store Filter</InputLabel>
              <Select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                label="Store Filter"
              >
                <MenuItem value="all">All Stores</MenuItem>
                {stores.map(store => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1}>
              <Chip
                label="Today"
                onClick={() => {}}
                variant="outlined"
              />
              <Chip
                label="This Week"
                onClick={() => {}}
                variant="outlined"
              />
              <Chip
                label="This Month"
                onClick={() => {}}
                variant="outlined"
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Document List with Tabs */}
      <Card>
        <CardContent>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
            {tabContent.map((tab, index) => (
              <Tab
                key={index}
                label={
                  <Box display="flex" alignItems="center">
                    {tab.label}
                    <Chip
                      label={tab.count}
                      size="small"
                      sx={{ ml: 1 }}
                      color={index === 0 ? 'default' : index === 1 ? 'primary' : index === 2 ? 'success' : 'error'}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>

          {/* Document List */}
          <List>
            {filteredDocuments.map((doc, index) => (
              <React.Fragment key={doc.id}>
                <ListItem>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                      {getFileIcon(doc.fileName)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center">
                        <Typography variant="subtitle1" fontWeight="medium">
                          {doc.fileName}
                        </Typography>
                        <Chip
                          label={doc.storeName}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                        {doc.status === 'completed' && doc.confidence && (
                          <Chip
                            label={`${(doc.confidence * 100).toFixed(0)}% confidence`}
                            size="small"
                            color={doc.confidence > 0.8 ? 'success' : 'warning'}
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Uploaded {format(new Date(doc.uploadDate), 'MMM d, yyyy h:mm a')}
                          {doc.processingTime && ` • Processed in ${doc.processingTime.toFixed(1)}s`}
                        </Typography>
                        {doc.extractedData && (
                          <Box display="flex" alignItems="center" mt={1}>
                            {doc.extractedData.orderNumber && (
                              <Chip
                                label={`Order #${doc.extractedData.orderNumber}`}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {doc.extractedData.customerName && (
                              <Chip
                                label={doc.extractedData.customerName}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {doc.extractedData.totalAmount && (
                              <Chip
                                label={`$${doc.extractedData.totalAmount.toFixed(2)}`}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {doc.extractedData.itemCount && (
                              <Chip
                                label={`${doc.extractedData.itemCount} items`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        )}
                        {doc.status === 'processing' && (
                          <LinearProgress sx={{ mt: 1 }} />
                        )}
                        {doc.status === 'failed' && doc.errors && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {doc.errors.join(', ')}
                          </Alert>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1}>
                      {getStatusIcon(doc.status)}
                      <IconButton size="small">
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < filteredDocuments.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>

          {filteredDocuments.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                No documents found
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default DocumentProcessingPage;