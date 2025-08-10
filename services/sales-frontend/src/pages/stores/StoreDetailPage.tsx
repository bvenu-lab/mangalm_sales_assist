import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  ShoppingCart as ShoppingCartIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  Store as StoreIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { Store, PredictedOrder, HistoricalInvoice, CallPrioritization } from '../../types/models';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`store-tabpanel-${index}`}
      aria-labelledby={`store-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const StoreDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [store, setStore] = useState<Store | null>(null);
  const [predictedOrders, setPredictedOrders] = useState<PredictedOrder[]>([]);
  const [historicalInvoices, setHistoricalInvoices] = useState<HistoricalInvoice[]>([]);
  const [callPrioritization, setCallPrioritization] = useState<CallPrioritization | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Fetch store data
  useEffect(() => {
    const fetchStoreData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch store details
        const storeResponse = await api.store.getById(id);
        setStore(storeResponse.data);
        
        // Fetch predicted orders for this store
        const ordersResponse = await api.predictedOrder.getByStore(id);
        setPredictedOrders(ordersResponse.data?.data || []);
        
        // Fetch historical invoices for this store
        const invoicesResponse = await api.invoice.getByStore(id);
        setHistoricalInvoices(invoicesResponse.data?.data || []);
        
        // Fetch call prioritization for this store
        // Since there's no direct getByStore method, we'll use getAll with a filter
        const callResponse = await api.callPrioritization.getAll({ storeId: id });
        if (callResponse.data?.data && callResponse.data.data.length > 0) {
          setCallPrioritization(callResponse.data.data[0]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching store data:', err);
        setError('Failed to load store data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchStoreData();
  }, [id]);
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Navigate to edit store
  const handleEditStore = () => {
    navigate(`/stores/${id}/edit`);
  };
  
  // Navigate to create order
  const handleCreateOrder = () => {
    navigate(`/orders/create?storeId=${id}`);
  };
  
  // Navigate to order detail
  const handleOrderClick = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };
  
  // Navigate to invoice detail
  const handleInvoiceClick = (invoiceId: string) => {
    navigate(`/invoices/${invoiceId}`);
  };
  
  // Navigate back to store list
  const handleBackToList = () => {
    navigate('/stores');
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }
  
  // Render error state
  if (error || !store) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography color="error" variant="h6">
          {error || 'Store not found'}
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={1}>
        <IconButton onClick={handleBackToList} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {store.name}
        </Typography>
      </Box>
      
      {/* Store Info Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h6" gutterBottom>
                Store Information
              </Typography>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEditStore}
              >
                Edit
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" mb={1}>
                  <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {store.address || 'No address provided'}
                    {store.city && `, ${store.city}`}
                    {store.region && `, ${store.region}`}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" mb={1}>
                  <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {store.phone || 'No phone provided'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" mb={1}>
                  <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body1">
                    {store.email || 'No email provided'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Contact Person
                </Typography>
                <Typography variant="body1">
                  {store.contactPerson || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Store Size
                </Typography>
                <Typography variant="body1">
                  {store.storeSize || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Call Frequency
                </Typography>
                <Typography variant="body1">
                  {store.callFrequency || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Notes
                </Typography>
                <Typography variant="body1">
                  {store.notes || 'No notes available'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Call Prioritization
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {callPrioritization ? (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body1" fontWeight="medium">
                    Priority Score
                  </Typography>
                  <Chip 
                    label={
                      callPrioritization.priorityScore >= 8 ? 'High' : 
                      callPrioritization.priorityScore >= 5 ? 'Medium' : 'Low'
                    }
                    color={
                      callPrioritization.priorityScore >= 8 ? 'error' : 
                      callPrioritization.priorityScore >= 5 ? 'warning' : 'default'
                    }
                  />
                </Box>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Priority Reason
                  </Typography>
                  <Typography variant="body1">
                    {callPrioritization.priorityReason || 'Regular follow-up'}
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Last Call
                    </Typography>
                    <Typography variant="body1">
                      {callPrioritization.lastCallDate 
                        ? new Date(callPrioritization.lastCallDate).toLocaleDateString() 
                        : 'No previous calls'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Next Call
                    </Typography>
                    <Typography variant="body1">
                      {callPrioritization.nextCallDate 
                        ? new Date(callPrioritization.nextCallDate).toLocaleDateString() 
                        : 'Not scheduled'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={callPrioritization.status}
                      color={
                        callPrioritization.status === 'Completed' ? 'success' : 
                        callPrioritization.status === 'Skipped' ? 'default' : 'primary'
                      }
                      size="small" 
                    />
                  </Grid>
                </Grid>
                <Box mt={3} display="flex" justifyContent="center">
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<ShoppingCartIcon />}
                    onClick={handleCreateOrder}
                  >
                    Create New Order
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <Typography variant="body1" color="text.secondary">
                  No call prioritization data available
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Tabs */}
      <Paper elevation={2}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Predicted Orders" icon={<ShoppingCartIcon />} iconPosition="start" />
          <Tab label="Order History" icon={<CalendarIcon />} iconPosition="start" />
        </Tabs>
        
        {/* Predicted Orders Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Predicted Orders
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreateOrder}
            >
              Create New Order
            </Button>
          </Box>
          
          {predictedOrders.length === 0 ? (
            <Alert severity="info">
              No predicted orders available for this store.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Typography variant="subtitle2">Date</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Items</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Status</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Notes</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Actions</Typography></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {predictedOrders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      hover 
                      onClick={() => handleOrderClick(order.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {new Date(order.predictionDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {order.items?.length || 0} items
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={order.status}
                          color={
                            order.status === 'Completed' ? 'success' : 
                            order.status === 'Confirmed' ? 'primary' : 
                            'default'
                          }
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {order.notes || 'No notes'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="primary" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order.id);
                          }}
                          title="View order details"
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
        
        {/* Order History Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Order History
          </Typography>
          
          {historicalInvoices.length === 0 ? (
            <Alert severity="info">
              No order history available for this store.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Typography variant="subtitle2">Invoice Date</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Amount</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Payment Status</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Notes</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Actions</Typography></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historicalInvoices.map((invoice) => (
                    <TableRow 
                      key={invoice.id} 
                      hover 
                      onClick={() => handleInvoiceClick(invoice.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        ${invoice.totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={invoice.paymentStatus || 'Paid'}
                          color={
                            invoice.paymentStatus === 'Paid' ? 'success' : 
                            invoice.paymentStatus === 'Pending' ? 'warning' : 
                            'error'
                          }
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {invoice.notes || 'No notes'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="primary" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInvoiceClick(invoice.id);
                          }}
                          title="View invoice details"
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default StoreDetailPage;
