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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormGroup,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup
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
  Store as StoreIcon,
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
  CompareArrows as CompareArrowsIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  Brush,
  LabelList
} from 'recharts';
import api from '../../services/api';
import apiGatewayClient from '../../services/api-gateway-client';
import { Store, PredictedOrder, HistoricalInvoice, CallPrioritization } from '../../types/models';

interface ChartDataPoint {
  date: string;
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  [key: string]: any; // For dynamic product columns
}

interface ProductSalesData {
  productName: string;
  visible: boolean;
  color: string;
  data: { date: string; quantity: number; revenue: number }[];
}

type TimeWindow = 'week' | 'month' | 'quarter' | 'year' | 'all';
type ChartType = 'line' | 'bar' | 'area' | 'composed';
type ComparisonMode = 'none' | 'yoy' | 'mom' | 'wow';

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
  
  // Analytics state
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('month');
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [productSalesData, setProductSalesData] = useState<ProductSalesData[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Set<string>>(new Set());
  const [showTotalRevenue, setShowTotalRevenue] = useState(true);
  const [showOrderCount, setShowOrderCount] = useState(true);
  const [showAvgOrderValue, setShowAvgOrderValue] = useState(false);
  
  // Process invoice data for charts
  const processChartData = (invoices: HistoricalInvoice[], window: TimeWindow) => {
    if (!invoices || invoices.length === 0) return;
    
    // Group data by time period
    const groupedData = new Map<string, any>();
    const productData = new Map<string, Map<string, { quantity: number; revenue: number }>>();
    
    invoices.forEach(invoice => {
      // Skip invalid invoices
      const amount = typeof invoice.totalAmount === 'number' ? invoice.totalAmount : parseFloat(invoice.totalAmount);
      if (isNaN(amount)) {
        console.warn('Skipping invoice with invalid totalAmount:', {
          invoice,
          originalAmount: invoice.totalAmount,
          parsedAmount: amount,
          isNaN: isNaN(amount)
        });
        return;
      }
      // Don't mutate the original object, use the parsed amount directly
      
      const date = new Date(invoice.invoiceDate);
      let periodKey: string;
      
      switch (window) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'year':
          periodKey = String(date.getFullYear());
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }
      
      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, {
          date: periodKey,
          totalRevenue: 0,
          orderCount: 0,
          orders: []
        });
      }
      
      const group = groupedData.get(periodKey);
      group.totalRevenue += amount;
      group.orderCount += 1;
      group.orders.push(invoice);
      
      // Process items if available
      if (invoice.items) {
        invoice.items.forEach((item: any) => {
          if (!productData.has(item.productName)) {
            productData.set(item.productName, new Map());
          }
          const productPeriods = productData.get(item.productName)!;
          if (!productPeriods.has(periodKey)) {
            productPeriods.set(periodKey, { quantity: 0, revenue: 0 });
          }
          const periodData = productPeriods.get(periodKey)!;
          periodData.quantity += (item.quantity || 0);
          periodData.revenue += (item.quantity || 0) * (item.unitPrice || 0);
        });
      }
    });
    
    // Convert to array and calculate averages
    const chartPoints: ChartDataPoint[] = Array.from(groupedData.values())
      .map(group => ({
        ...group,
        avgOrderValue: group.orderCount > 0 ? group.totalRevenue / group.orderCount : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Process product data
    const products: ProductSalesData[] = Array.from(productData.entries()).map(([name, periods], index) => {
      const color = `hsl(${(index * 360) / productData.size}, 70%, 50%)`;
      const data = chartPoints.map(point => ({
        date: point.date,
        quantity: periods.get(point.date)?.quantity || 0,
        revenue: periods.get(point.date)?.revenue || 0
      }));
      return {
        productName: name,
        visible: index < 5, // Show top 5 by default
        color,
        data
      };
    });
    
    // Add product data to chart points
    chartPoints.forEach(point => {
      products.forEach(product => {
        const productPoint = product.data.find(p => p.date === point.date);
        if (productPoint) {
          point[`${product.productName}_quantity`] = productPoint.quantity;
          point[`${product.productName}_revenue`] = productPoint.revenue;
        }
      });
    });
    
    setChartData(chartPoints);
    setProductSalesData(products);
    setVisibleProducts(new Set(products.slice(0, 5).map(p => p.productName)));
  };
  
  // Fetch store data
  useEffect(() => {
    let mounted = true;
    const fetchStoreData = async () => {
      if (!id || !mounted) return;
      
      try {
        setLoading(true);
        console.log('[StoreDetailPage] Starting to fetch data for store:', id);
        
        // Fetch store details
        console.log('[StoreDetailPage] Fetching store details...');
        const storeResponse = await api.store.getById(id);
        console.log('[StoreDetailPage] Store response:', JSON.stringify(storeResponse, null, 2));
        console.log('[StoreDetailPage] Store response type:', typeof storeResponse);
        console.log('[StoreDetailPage] Store response keys:', storeResponse ? Object.keys(storeResponse) : 'null');
        setStore(storeResponse);
        
        // Fetch predicted orders for this store
        console.log('[StoreDetailPage] Fetching predicted orders for store:', id);
        const ordersResponse = await api.predictedOrder.getByStore(id);
        console.log('[StoreDetailPage] Orders response:', JSON.stringify(ordersResponse, null, 2));
        // Handle both direct array and success/data wrapper formats
        const ordersData = ordersResponse?.success ? ordersResponse.data : ordersResponse?.data || ordersResponse || [];
        // Map and filter for this specific store
        const mappedOrders = Array.isArray(ordersData) ? ordersData
          .filter((order: any) => order.store_id === id || order.storeId === id)
          .map((order: any) => ({
            id: order.id,
            storeId: order.store_id || order.storeId,
            store: order.store,
            predictionDate: order.prediction_date || order.predictionDate,
            status: order.status || 'Pending',
            items: order.predicted_items || order.items || [],
            confidenceScore: order.confidence_score || order.confidenceScore,
            estimatedValue: parseFloat(order.estimated_value || order.estimatedValue) || 0,
            notes: order.notes,
            createdAt: order.created_at || order.createdAt || new Date().toISOString(),
            updatedAt: order.updated_at || order.updatedAt
          })) : [];
        setPredictedOrders(mappedOrders);
        
        // Fetch historical invoices for this store
        console.log('[StoreDetailPage] Fetching invoices for store:', id);
        const invoicesResponse = await api.invoice.getByStore(id);
        console.log('[StoreDetailPage] Invoices API response:', JSON.stringify(invoicesResponse, null, 2));
        // Extract data from success/data wrapper if present
        const invoicesData = invoicesResponse?.success ? invoicesResponse.data : invoicesResponse?.data || invoicesResponse || [];
        console.log('[StoreDetailPage] Extracted invoices data:', invoicesData);
        // Map snake_case fields to camelCase
        const mappedInvoices = Array.isArray(invoicesData) ? invoicesData.map((inv: any, index: number) => {
          console.log(`[StoreDetailPage] Processing invoice ${index}:`, {
            raw_total_amount: inv.total_amount,
            raw_totalAmount: inv.totalAmount,
            type_of_total_amount: typeof inv.total_amount,
            parsed: parseFloat(inv.total_amount || inv.totalAmount)
          });
          
          return {
            id: inv.id,
            storeId: inv.store_id || inv.storeId,
            storeName: inv.store_name || inv.storeName,
            invoiceDate: inv.invoice_date || inv.invoiceDate,
            totalAmount: parseFloat(inv.total_amount || inv.totalAmount) || 0,
            paymentStatus: inv.payment_status || inv.paymentStatus || 'Paid',
            notes: inv.notes,
            items: inv.items || [],
            createdAt: inv.created_at || inv.createdAt || inv.invoice_date || new Date().toISOString(),
            updatedAt: inv.updated_at || inv.updatedAt
          };
        }) : [];
        console.log('[StoreDetailPage] Mapped invoices:', mappedInvoices);
        setHistoricalInvoices(mappedInvoices);
        
        // Fetch call prioritization for this store
        console.log('[StoreDetailPage] Fetching call prioritization...');
        const callResponse = await api.callPrioritization.getAll({ storeId: id });
        console.log('[StoreDetailPage] Call prioritization response:', callResponse);
        // Extract and find relevant call prioritization for this store
        const callData = callResponse?.success ? callResponse.data : callResponse?.data || callResponse || [];
        const storeCallData = Array.isArray(callData) ? 
          callData.find((c: any) => c.store_id === id || c.storeId === id) : null;
        if (storeCallData) {
          // Map snake_case to camelCase
          const mappedCallData = {
            id: storeCallData.id,
            storeId: storeCallData.store_id || storeCallData.storeId,
            priorityScore: storeCallData.priority_score || storeCallData.priorityScore || 5,
            priorityReason: storeCallData.priority_reason || storeCallData.priorityReason || 'Regular follow-up',
            lastCallDate: storeCallData.last_call_date || storeCallData.lastCallDate,
            nextCallDate: storeCallData.next_call_date || storeCallData.scheduled_date || storeCallData.nextCallDate,
            status: storeCallData.status || 'Pending',
            createdAt: storeCallData.created_at || storeCallData.createdAt || new Date().toISOString(),
            updatedAt: storeCallData.updated_at || storeCallData.updatedAt
          };
          setCallPrioritization(mappedCallData);
        }
        
        console.log('[StoreDetailPage] All data fetched successfully');
        console.log('[StoreDetailPage] Final store state:', storeResponse);
        
        // Determine best time window based on data range and process chart data
        if (mappedInvoices.length > 0) {
          const dates = mappedInvoices.map((inv: any) => new Date(inv.invoiceDate));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
          
          let defaultWindow: TimeWindow = 'month';
          if (daysDiff <= 35) {
            defaultWindow = 'week';
          } else if (daysDiff <= 180) {
            defaultWindow = 'month';
          } else if (daysDiff <= 365) {
            defaultWindow = 'quarter';
          } else {
            defaultWindow = 'year';
          }
          
          console.log('[StoreDetailPage] Date range:', daysDiff, 'days, using window:', defaultWindow);
          setTimeWindow(defaultWindow);
          processChartData(mappedInvoices, defaultWindow);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('[StoreDetailPage] Error fetching store data:', err);
        if (mounted) {
          setError('Failed to load store data. Please try again later.');
        }
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    fetchStoreData();
    
    return () => {
      mounted = false;
    };
  }, [id]);
  
  // Update chart data when time window changes
  useEffect(() => {
    if (historicalInvoices.length > 0) {
      console.log('[StoreDetailPage] Reprocessing chart data with window:', timeWindow);
      processChartData(historicalInvoices, timeWindow);
    }
  }, [timeWindow, comparisonMode]);
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle time window change
  const handleTimeWindowChange = (event: SelectChangeEvent<TimeWindow>) => {
    setTimeWindow(event.target.value as TimeWindow);
  };
  
  // Handle chart type change
  const handleChartTypeChange = (_event: React.MouseEvent<HTMLElement>, newType: ChartType | null) => {
    if (newType) {
      setChartType(newType);
    }
  };
  
  // Handle comparison mode change
  const handleComparisonModeChange = (event: SelectChangeEvent<ComparisonMode>) => {
    setComparisonMode(event.target.value as ComparisonMode);
  };
  
  // Toggle product visibility
  const toggleProductVisibility = (productName: string) => {
    const newVisible = new Set(visibleProducts);
    if (newVisible.has(productName)) {
      newVisible.delete(productName);
    } else {
      newVisible.add(productName);
    }
    setVisibleProducts(newVisible);
  };
  
  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2">{label}</Typography>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} variant="body2" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? 
                (entry.name.includes('Revenue') || entry.name.includes('Value') ? 
                  `$${entry.value.toFixed(2)}` : entry.value.toFixed(0)) : 
                entry.value}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };
  
  // Navigate to edit store
  const handleEditStore = () => {
    navigate(`/stores/${id}/edit`);
  };
  
  // Navigate to create order
  const handleCreateOrder = () => {
    if (predictedOrders.length > 0) {
      // Use the first predicted order
      navigate(`/orders/create/${predictedOrders[0].id}`);
    } else {
      // Create new order for this store
      navigate(`/orders/create?storeId=${id}`);
    }
  };

  // Handle navigation to next priority call
  const handleNextPriorityCall = async () => {
    try {
      const response = await apiGatewayClient.get(`/api/calls/next-priority/${id}`);
      if (response?.data?.store_id) {
        navigate(`/stores/${response.data.store_id}`);
      } else {
        // No next priority, go to calls list
        navigate('/calls');
      }
    } catch (error) {
      console.error('Error fetching next priority call:', error);
      navigate('/calls');
    }
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
  
  // Debug logging
  console.log('[StoreDetailPage] Render state:', {
    loading,
    error,
    storeJSON: JSON.stringify(store),
    storeId: id,
    hasStore: !!store,
    storeKeys: store ? Object.keys(store) : [],
    storeName: store?.name,
    storeAddress: store?.address
  });
  
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
    console.log('[StoreDetailPage] Showing error state:', { error, store });
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
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '400px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Store Information
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={handleEditStore}
              >
                Edit
              </Button>
            </Box>
            <Divider sx={{ mb: 3, borderWidth: 2 }} />
            
            {/* Store Details List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Address
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {store.address || 'No address'}, {store.city || 'No city'}, {store.region || 'No region'}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PhoneIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {store.phone || 'No phone'}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EmailIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {store.email || 'No email provided'}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StoreIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Contact Person
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {store.contactPerson || 'Not specified'}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CalendarIcon sx={{ mr: 2, color: 'primary.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Store Size / Call Frequency
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {store.storeSize || 'Medium'} / {store.callFrequency || 'Weekly'}
                  </Typography>
                </Box>
              </Box>
            </Box>
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
                <Box mt={3} display="flex" justifyContent="space-between" gap={2}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleNextPriorityCall}
                  >
                    Next Priority Call →
                  </Button>
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
          <Tab label="Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Predicted Orders" icon={<ShoppingCartIcon />} iconPosition="start" />
          <Tab label="Order History" icon={<CalendarIcon />} iconPosition="start" />
        </Tabs>
        
        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Controls */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={timeWindow}
                    onChange={handleTimeWindowChange}
                    label="Time Period"
                  >
                    <MenuItem value="week">Weekly</MenuItem>
                    <MenuItem value="month">Monthly</MenuItem>
                    <MenuItem value="quarter">Quarterly</MenuItem>
                    <MenuItem value="year">Yearly</MenuItem>
                    <MenuItem value="all">All Time</MenuItem>
                  </Select>
                </FormControl>
                
                <ToggleButtonGroup
                  value={chartType}
                  exclusive
                  onChange={handleChartTypeChange}
                  size="small"
                >
                  <ToggleButton value="line">
                    <ShowChartIcon sx={{ mr: 0.5 }} /> Line
                  </ToggleButton>
                  <ToggleButton value="bar">
                    <BarChartIcon sx={{ mr: 0.5 }} /> Bar
                  </ToggleButton>
                  <ToggleButton value="area">
                    <TrendingUpIcon sx={{ mr: 0.5 }} /> Area
                  </ToggleButton>
                  <ToggleButton value="composed">
                    <CompareArrowsIcon sx={{ mr: 0.5 }} /> Combined
                  </ToggleButton>
                </ToggleButtonGroup>
                
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Comparison</InputLabel>
                  <Select
                    value={comparisonMode}
                    onChange={handleComparisonModeChange}
                    label="Comparison"
                  >
                    <MenuItem value="none">No Comparison</MenuItem>
                    <MenuItem value="yoy">Year over Year</MenuItem>
                    <MenuItem value="mom">Month over Month</MenuItem>
                    <MenuItem value="wow">Week over Week</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grid>
            
            {/* Main Chart */}
            <Grid item xs={12} lg={9}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Sales Performance
                </Typography>
                
                {chartData.length === 0 ? (
                  <Alert severity="info">No sales data available for the selected period</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    {chartType === 'composed' ? (
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Brush dataKey="date" height={30} stroke="#8884d8" />
                        
                        {showTotalRevenue && (
                          <Bar yAxisId="left" dataKey="totalRevenue" fill="#8884d8" name="Total Revenue" />
                        )}
                        {showOrderCount && (
                          <Line yAxisId="right" type="monotone" dataKey="orderCount" stroke="#82ca9d" name="Order Count" strokeWidth={2} />
                        )}
                        {showAvgOrderValue && (
                          <Line yAxisId="left" type="monotone" dataKey="avgOrderValue" stroke="#ff7300" name="Avg Order Value" strokeWidth={2} />
                        )}
                        
                        {/* Add product lines if visible */}
                        {productSalesData.filter(p => visibleProducts.has(p.productName)).map(product => (
                          <Line
                            key={product.productName}
                            yAxisId="right"
                            type="monotone"
                            dataKey={`${product.productName}_quantity`}
                            stroke={product.color}
                            name={product.productName}
                            strokeWidth={1.5}
                          />
                        ))}
                        
                        {/* Add comparison reference lines if enabled */}
                        {comparisonMode === 'yoy' && chartData.length > 12 && (
                          <ReferenceLine
                            yAxisId="left"
                            y={chartData[chartData.length - 13]?.totalRevenue || 0}
                            stroke="red"
                            strokeDasharray="5 5"
                            label="Year Ago"
                          />
                        )}
                      </ComposedChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        
                        {showTotalRevenue && (
                          <Line type="monotone" dataKey="totalRevenue" stroke="#8884d8" name="Total Revenue" />
                        )}
                        {showOrderCount && (
                          <Line type="monotone" dataKey="orderCount" stroke="#82ca9d" name="Order Count" />
                        )}
                        {showAvgOrderValue && (
                          <Line type="monotone" dataKey="avgOrderValue" stroke="#ff7300" name="Avg Order Value" />
                        )}
                        
                        {/* Add product lines */}
                        {productSalesData.filter(p => visibleProducts.has(p.productName)).map(product => (
                          <Line
                            key={product.productName}
                            type="monotone"
                            dataKey={`${product.productName}_quantity`}
                            stroke={product.color}
                            name={`${product.productName} (Qty)`}
                            strokeWidth={1.5}
                          />
                        ))}
                      </LineChart>
                    ) : chartType === 'bar' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        
                        {showTotalRevenue && (
                          <Bar dataKey="totalRevenue" fill="#8884d8" name="Total Revenue">
                            <LabelList dataKey="totalRevenue" position="top" />
                          </Bar>
                        )}
                        {showOrderCount && (
                          <Bar dataKey="orderCount" fill="#82ca9d" name="Order Count" />
                        )}
                        
                        {/* Add product bars */}
                        {productSalesData.filter(p => visibleProducts.has(p.productName)).map(product => (
                          <Bar
                            key={product.productName}
                            dataKey={`${product.productName}_quantity`}
                            fill={product.color}
                            name={`${product.productName} (Qty)`}
                          />
                        ))}
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        
                        {showTotalRevenue && (
                          <Area type="monotone" dataKey="totalRevenue" stroke="#8884d8" fill="#8884d8" name="Total Revenue" />
                        )}
                        {showOrderCount && (
                          <Area type="monotone" dataKey="orderCount" stroke="#82ca9d" fill="#82ca9d" name="Order Count" />
                        )}
                        {showAvgOrderValue && (
                          <Area type="monotone" dataKey="avgOrderValue" stroke="#ff7300" fill="#ff7300" name="Avg Order Value" />
                        )}
                        
                        {/* Add product areas */}
                        {productSalesData.filter(p => visibleProducts.has(p.productName)).map(product => (
                          <Area
                            key={product.productName}
                            type="monotone"
                            dataKey={`${product.productName}_quantity`}
                            stroke={product.color}
                            fill={product.color}
                            name={`${product.productName} (Qty)`}
                            fillOpacity={0.6}
                          />
                        ))}
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            
            {/* Legend Controls */}
            <Grid item xs={12} lg={3}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Chart Controls
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Metrics
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showTotalRevenue}
                        onChange={(e) => setShowTotalRevenue(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Total Revenue"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showOrderCount}
                        onChange={(e) => setShowOrderCount(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Order Count"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showAvgOrderValue}
                        onChange={(e) => setShowAvgOrderValue(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Avg Order Value"
                  />
                </FormGroup>
                
                {productSalesData.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Products
                    </Typography>
                    <FormGroup>
                      {productSalesData.map(product => (
                        <FormControlLabel
                          key={product.productName}
                          control={
                            <Checkbox
                              checked={visibleProducts.has(product.productName)}
                              onChange={() => toggleProductVisibility(product.productName)}
                              style={{ color: product.color }}
                            />
                          }
                          label={
                            <Typography variant="body2" noWrap title={product.productName}>
                              {product.productName.length > 20 
                                ? `${product.productName.substring(0, 20)}...` 
                                : product.productName}
                            </Typography>
                          }
                        />
                      ))}
                    </FormGroup>
                  </>
                )}
              </Paper>
            </Grid>
            
            {/* Summary Statistics */}
            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Revenue
                      </Typography>
                      <Typography variant="h5">
                        ${chartData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0).toFixed(2)}
                      </Typography>
                      {comparisonMode === 'yoy' && chartData.length > 12 && chartData[chartData.length - 13]?.totalRevenue > 0 && (
                        <Typography variant="body2" color={chartData[chartData.length - 1]?.totalRevenue > chartData[chartData.length - 13]?.totalRevenue ? 'success.main' : 'error.main'}>
                          {(((chartData[chartData.length - 1]?.totalRevenue || 0) - (chartData[chartData.length - 13]?.totalRevenue || 0)) / chartData[chartData.length - 13].totalRevenue * 100).toFixed(1)}% YoY
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Orders
                      </Typography>
                      <Typography variant="h5">
                        {chartData.reduce((sum, d) => sum + (d.orderCount || 0), 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Average Order Value
                      </Typography>
                      <Typography variant="h5">
                        ${(chartData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0) / Math.max(1, chartData.reduce((sum, d) => sum + (d.orderCount || 0), 0))).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Peak Month
                      </Typography>
                      <Typography variant="h5">
                        {chartData.reduce((peak, d) => (d?.totalRevenue || 0) > (peak?.totalRevenue || 0) ? d : peak, chartData[0])?.date || 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Predicted Orders Tab */}
        <TabPanel value={tabValue} index={1}>
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
        <TabPanel value={tabValue} index={2}>
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
                        ${invoice.totalAmount ? Number(invoice.totalAmount).toFixed(2) : '0.00'}
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
