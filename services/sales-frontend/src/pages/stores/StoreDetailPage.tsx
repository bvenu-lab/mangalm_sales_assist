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
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormGroup,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
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
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CalendarToday as CalendarIcon,
  Store as StoreIcon,
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
  Recommend as RecommendIcon,
  TipsAndUpdates as TipsIcon,
  CompareArrows as CompareArrowsIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon,
  CloudUpload as CloudUploadIcon,
  Description as DocumentIcon,
  Close as CloseIcon
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
import DocumentUpload from '../../components/documents/DocumentUpload';
import { documentApi } from '../../services/document-api';
import { formatCurrency } from '../../utils/formatting';

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
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [historicalInvoices, setHistoricalInvoices] = useState<HistoricalInvoice[]>([]);
  const [callPrioritization, setCallPrioritization] = useState<CallPrioritization | null>(null);
  const [totalStores, setTotalStores] = useState<number>(0);
  const [upsellingRecommendations, setUpsellingRecommendations] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);

  // Analytics state
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('month');
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [productSalesData, setProductSalesData] = useState<ProductSalesData[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Set<string>>(new Set());

  // CRITICAL: Create safe wrapper functions to NEVER allow null arrays
  const safePredictedOrdersSetter = (data: any) => {
    const safeData = Array.isArray(data) ? data : [];
    console.log('[SAFETY] setPredictedOrders:', typeof data, Array.isArray(data), '-> setting:', safeData);
    if (safeData === null || safeData === undefined) {
      console.error('[CRITICAL] safePredictedOrdersSetter received null/undefined after safety check:', data);
      setPredictedOrders([]);
    } else {
      setPredictedOrders(safeData);
    }
  };

  const safeRecentOrdersSetter = (data: any) => {
    const safeData = Array.isArray(data) ? data : [];
    console.log('[SAFETY] setRecentOrders:', typeof data, Array.isArray(data), '-> setting:', safeData);
    setRecentOrders(safeData);
  };

  const safeHistoricalInvoicesSetter = (data: any) => {
    const safeData = Array.isArray(data) ? data : [];
    console.log('[SAFETY] setHistoricalInvoices:', typeof data, Array.isArray(data), '-> setting:', safeData);
    setHistoricalInvoices(safeData);
  };

  const safeChartDataSetter = (data: any) => {
    const safeData = Array.isArray(data) ? data : [];
    console.log('[SAFETY] setChartData:', typeof data, Array.isArray(data), '-> setting:', safeData);
    setChartData(safeData);
  };

  const safeProductSalesDataSetter = (data: any) => {
    const safeData = Array.isArray(data) ? data : [];
    console.log('[SAFETY] setProductSalesData:', typeof data, Array.isArray(data), '-> setting:', safeData);
    setProductSalesData(safeData);
  };

  // CRITICAL: Monitor all array states for null values AND override direct setters
  useEffect(() => {
    const checkArrays = () => {
      if (predictedOrders === null) {
        console.error('[CRITICAL NULL] predictedOrders is NULL! Forcing to empty array.');
        setPredictedOrders([]);
      }
      if (recentOrders === null) {
        console.error('[CRITICAL NULL] recentOrders is NULL! Forcing to empty array.');
        setRecentOrders([]);
      }
      if (historicalInvoices === null) {
        console.error('[CRITICAL NULL] historicalInvoices is NULL! Forcing to empty array.');
        setHistoricalInvoices([]);
      }
      if (chartData === null) {
        console.error('[CRITICAL NULL] chartData is NULL! Forcing to empty array.');
        setChartData([]);
      }
      if (productSalesData === null) {
        console.error('[CRITICAL NULL] productSalesData is NULL! Forcing to empty array.');
        setProductSalesData([]);
      }

      // Check for non-array types
      if (!Array.isArray(predictedOrders)) {
        console.error('[NOT ARRAY] predictedOrders is not array:', typeof predictedOrders, predictedOrders);
        setPredictedOrders([]);
      }
      if (!Array.isArray(recentOrders)) {
        console.error('[NOT ARRAY] recentOrders is not array:', typeof recentOrders, recentOrders);
        setRecentOrders([]);
      }
      if (!Array.isArray(historicalInvoices)) {
        console.error('[NOT ARRAY] historicalInvoices is not array:', typeof historicalInvoices, historicalInvoices);
        setHistoricalInvoices([]);
      }
      if (!Array.isArray(chartData)) {
        console.error('[NOT ARRAY] chartData is not array:', typeof chartData, chartData);
        setChartData([]);
      }
      if (!Array.isArray(productSalesData)) {
        console.error('[NOT ARRAY] productSalesData is not array:', typeof productSalesData, productSalesData);
        setProductSalesData([]);
      }
    };
    checkArrays();
  }, [predictedOrders, recentOrders, historicalInvoices, chartData, productSalesData]);

  const [showTotalRevenue, setShowTotalRevenue] = useState(true);
  const [showOrderCount, setShowOrderCount] = useState(true);
  const [showAvgOrderValue, setShowAvgOrderValue] = useState(false);
  
  // Handle order deletion
  const handleDeleteOrder = (order: any) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      // Call API to delete order
      await apiGatewayClient.delete(`/api/orders/${orderToDelete.id}`);
      
      // Update local state to remove the deleted order
      safeRecentOrdersSetter(recentOrders.filter(o => o.id !== orderToDelete.id));
      
      // Show success message
      console.log('Order deleted successfully');
    } catch (error) {
      console.error('Failed to delete order:', error);
      setError('Failed to delete order. Please try again.');
    } finally {
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

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
      const data = (chartPoints || []).map(point => ({
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
    (chartPoints || []).forEach(point => {
      (products || []).forEach(product => {
        const productPoint = (product.data || []).find(p => p.date === point.date);
        if (productPoint) {
          point[`${product.productName}_quantity`] = productPoint.quantity;
          point[`${product.productName}_revenue`] = productPoint.revenue;
        }
      });
    });
    
    console.log('[StoreDetailPage] Setting chart data:', chartPoints, 'isArray:', Array.isArray(chartPoints));
    console.log('[StoreDetailPage] Setting product sales data:', products, 'isArray:', Array.isArray(products));
    safeChartDataSetter(chartPoints);
    safeProductSalesDataSetter(products);
    setVisibleProducts(new Set(products.slice(0, 5).map(p => p.productName)));
  };
  
  // Fetch store data
  useEffect(() => {
    console.log('[DEBUG] useEffect triggered with id:', id);
    console.log('[DEBUG] Current state before reset:', {
      predictedOrders: predictedOrders?.length || 'null/undefined',
      recentOrders: recentOrders?.length || 'null/undefined',
      historicalInvoices: historicalInvoices?.length || 'null/undefined',
      chartData: chartData?.length || 'null/undefined',
      productSalesData: productSalesData?.length || 'null/undefined'
    });

    // Set loading FIRST to prevent rendering with mixed state
    setLoading(true);

    // Reset state when ID changes
    setStore(null);
    safePredictedOrdersSetter([]);
    safeRecentOrdersSetter([]);
    safeHistoricalInvoicesSetter([]);
    setCallPrioritization(null);
    safeChartDataSetter([]);
    safeProductSalesDataSetter([]);
    setVisibleProducts(new Set());
    setError(null);

    console.log('[DEBUG] State reset completed, loading set to true');

    let mounted = true;
    const fetchStoreData = async () => {
      if (!id || !mounted) return;

      try {
        console.log('[StoreDetailPage] Starting to fetch data for store:', id);
        
        // Fetch store details
        console.log('[StoreDetailPage] Fetching store details...');
        const storeResponse = await api.store.getById(id);
        console.log('[StoreDetailPage] Store response:', JSON.stringify(storeResponse, null, 2));
        console.log('[StoreDetailPage] Store response type:', typeof storeResponse);
        console.log('[StoreDetailPage] Store response keys:', storeResponse ? Object.keys(storeResponse) : 'null');
        
        if (!storeResponse || !storeResponse.id) {
          throw new Error('Invalid store data received');
        }
        
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
        console.log('[StoreDetailPage] Setting predicted orders:', mappedOrders, 'isArray:', Array.isArray(mappedOrders));
        safePredictedOrdersSetter(mappedOrders);
        
        // Fetch recent actual orders for this store
        console.log('[StoreDetailPage] Fetching recent actual orders for store:', id);
        try {
          const recentOrdersResponse = await apiGatewayClient.get(`/api/orders/recent?store_id=${id}&limit=20`);
          console.log('[StoreDetailPage] Recent orders response:', recentOrdersResponse);
          const recentOrdersData = recentOrdersResponse?.data;
          console.log('[StoreDetailPage] Recent orders data type:', typeof recentOrdersData, 'isArray:', Array.isArray(recentOrdersData), 'value:', recentOrdersData);
          safeRecentOrdersSetter(recentOrdersData);
        } catch (err) {
          console.error('[StoreDetailPage] Failed to fetch recent orders:', err);
          safeRecentOrdersSetter([]);
        }
        
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
        console.log('[StoreDetailPage] Setting historical invoices:', mappedInvoices, 'isArray:', Array.isArray(mappedInvoices));
        safeHistoricalInvoicesSetter(mappedInvoices);
        
        // Fetch call prioritization for this store with unique rank
        console.log('[StoreDetailPage] Fetching call prioritization...');
        try {
          // Get specific store's priority with correct unique rank
          const storePriorityResponse = await apiGatewayClient.get(`/api/calls/store-priority/${id}`);
          console.log('[StoreDetailPage] Store priority response:', storePriorityResponse);

          if (storePriorityResponse?.success && storePriorityResponse.data) {
            const storeCallData = storePriorityResponse.data;
            const mappedCallData = {
              id: storeCallData.storeId,
              storeId: storeCallData.storeId,
              priorityScore: storeCallData.priorityScore || 5,
              priorityReason: storeCallData.priorityReason || 'Regular follow-up',
              lastCallDate: storeCallData.lastCallDate,
              nextCallDate: storeCallData.nextCallDate,
              status: storeCallData.status || 'Pending',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setCallPrioritization(mappedCallData);
          }
        } catch (error) {
          console.log('[StoreDetailPage] Error fetching store priority, falling back to list method:', error);
          // Fallback to original method if new endpoint fails
          const callResponse = await api.callPrioritization.getAll({ storeId: id });
          const callData = callResponse?.success ? callResponse.data : callResponse?.data || callResponse || [];
          const storeCallData = Array.isArray(callData) ?
            callData.find((c: any) => c.store_id === id || c.storeId === id) : null;
          if (storeCallData) {
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
        }

        // Get total stores count for percentage calculations
        const callListResponse = await api.callPrioritization.getAll();
        const totalStoreCount = callListResponse?.totalStores || callListResponse?.total || 100;
        setTotalStores(totalStoreCount);

        // Fetch upselling recommendations for this store
        console.log('[StoreDetailPage] Fetching upselling recommendations...');
        try {
          const upsellingResponse = await apiGatewayClient.get(`/api/upselling/store/${id}`);
          console.log('[StoreDetailPage] Upselling response:', upsellingResponse);
          if (upsellingResponse?.success && upsellingResponse.data) {
            setUpsellingRecommendations(upsellingResponse.data);
          }
        } catch (error) {
          console.log('[StoreDetailPage] Error fetching upselling recommendations:', error);
          // Don't fail the page load if upselling fails
        }
        
        console.log('[StoreDetailPage] All data fetched successfully');
        console.log('[StoreDetailPage] Final store state:', storeResponse);
        
        // Determine best time window based on data range and process chart data
        if (mappedInvoices && mappedInvoices.length > 0) {
          console.log('[DEBUG] Processing chart data, mappedInvoices:', mappedInvoices?.length, 'items');

          let daysDiff = 30; // Default fallback

          try {
            const dates = (mappedInvoices || []).map((inv: any) => new Date(inv.invoiceDate));
            console.log('[DEBUG] Created dates array:', dates?.length, 'dates');

            if (!dates || dates.length === 0) {
              console.error('[DEBUG] Dates array is null or empty!');
              return;
            }

            const minDate = new Date(Math.min(...(dates || []).map(d => d.getTime())));
            const maxDate = new Date(Math.max(...(dates || []).map(d => d.getTime())));
            daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
            console.log('[DEBUG] Date range calculated:', daysDiff, 'days');
          } catch (error) {
            console.error('[DEBUG] Error in chart data processing:', error);
            console.error('[DEBUG] mappedInvoices at error:', mappedInvoices);
            // Continue with default daysDiff value
          }

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
      } catch (err: any) {
        console.error('[StoreDetailPage] Error fetching store data:', err);
        if (mounted) {
          const errorMessage = err.response?.data?.error || err.message || 'Failed to load store data. Please try again later.';
          setError(errorMessage);
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
          {(payload || []).map((entry: any, index: number) => (
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

  // Handle navigation up the priority list (to higher priority)
  const handleUpPriorityCall = async () => {
    try {
      console.log('[StoreDetailPage] Fetching prioritized calls list for UP navigation');

      // Get the prioritized calls list
      const response = await apiGatewayClient.get('/api/calls/prioritized?limit=100');
      const responseData = response?.data;
      const prioritizedCalls = Array.isArray(responseData?.data) ? responseData.data :
                              Array.isArray(responseData) ? responseData : [];

      if (!prioritizedCalls || prioritizedCalls.length === 0) {
        console.log('[StoreDetailPage] No prioritized calls available');
        alert('No prioritized calls available');
        return;
      }

      console.log('[StoreDetailPage] Prioritized calls:', prioritizedCalls.length);

      // Find current store index in the list
      const currentIndex = prioritizedCalls.findIndex((call: any) =>
        String(call.storeId) === String(id) || String(call.store_id) === String(id)
      );

      console.log('[StoreDetailPage] Current store index:', currentIndex);

      if (currentIndex > 0) {
        // Navigate UP to higher priority (previous in list)
        const higherPriorityCall = prioritizedCalls[currentIndex - 1];
        const higherPriorityStoreId = higherPriorityCall.storeId || higherPriorityCall.store_id;
        console.log('[StoreDetailPage] Navigating UP to higher priority store:', higherPriorityStoreId);
        navigate(`/stores/${higherPriorityStoreId}`);
        window.scrollTo(0, 0);
      } else if (currentIndex === 0) {
        // Already at highest priority (peak)
        console.log('[StoreDetailPage] Already at highest priority store (peak)');
        alert('Already at highest priority store');
      } else if (prioritizedCalls.length > 0) {
        // Current store not in list, go to highest priority
        const highestPriorityStoreId = prioritizedCalls[0].storeId || prioritizedCalls[0].store_id;
        console.log('[StoreDetailPage] Current store not in priority list, going to highest priority:', highestPriorityStoreId);
        navigate(`/stores/${highestPriorityStoreId}`);
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error fetching prioritized calls for UP navigation:', error);
      alert('Unable to navigate: Error loading priority data');
    }
  };

  // Handle navigation down the priority list (to lower priority)
  const handleDownPriorityCall = async () => {
    try {
      console.log('[StoreDetailPage] Fetching prioritized calls list for DOWN navigation');

      // Get the prioritized calls list
      const response = await apiGatewayClient.get('/api/calls/prioritized?limit=100');
      const responseData = response?.data;
      const prioritizedCalls = Array.isArray(responseData?.data) ? responseData.data :
                              Array.isArray(responseData) ? responseData : [];

      if (!prioritizedCalls || prioritizedCalls.length === 0) {
        console.log('[StoreDetailPage] No prioritized calls available');
        alert('No prioritized calls available');
        return;
      }

      console.log('[StoreDetailPage] Prioritized calls:', prioritizedCalls.length);

      // Find current store index in the list
      const currentIndex = prioritizedCalls.findIndex((call: any) =>
        String(call.storeId) === String(id) || String(call.store_id) === String(id)
      );

      console.log('[StoreDetailPage] Current store index:', currentIndex);

      if (currentIndex >= 0 && currentIndex < prioritizedCalls.length - 1) {
        // Navigate DOWN to lower priority (next in list)
        const lowerPriorityCall = prioritizedCalls[currentIndex + 1];
        const lowerPriorityStoreId = lowerPriorityCall.storeId || lowerPriorityCall.store_id;
        console.log('[StoreDetailPage] Navigating DOWN to lower priority store:', lowerPriorityStoreId);
        navigate(`/stores/${lowerPriorityStoreId}`);
        window.scrollTo(0, 0);
      } else if (currentIndex === prioritizedCalls.length - 1) {
        // Already at lowest priority (valley)
        console.log('[StoreDetailPage] Already at lowest priority store (valley)');
        alert('Already at lowest priority store');
      } else if (prioritizedCalls.length > 0) {
        // Current store not in list, go to highest priority (start of list)
        const highestPriorityStoreId = prioritizedCalls[0].storeId || prioritizedCalls[0].store_id;
        console.log('[StoreDetailPage] Current store not in priority list, going to highest priority:', highestPriorityStoreId);
        navigate(`/stores/${highestPriorityStoreId}`);
        window.scrollTo(0, 0);
      }
    } catch (error) {
      console.error('Error fetching prioritized calls for DOWN navigation:', error);
      alert('Unable to navigate: Error loading priority data');
    }
  };
  
  // Navigate to order detail
  const handleOrderClick = (orderId: string) => {
    // Check if it's a UUID (predicted order) or integer ID (regular order)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (isUuid) {
      navigate(`/predicted-orders/${orderId}`);
    } else {
      navigate(`/orders/${orderId}`);
    }
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

  // DEBUGGING: Log all array states before render
  console.log('[RENDER DEBUG] About to render with states:', {
    predictedOrders: predictedOrders ? predictedOrders.length : 'NULL',
    recentOrders: recentOrders ? recentOrders.length : 'NULL',
    historicalInvoices: historicalInvoices ? historicalInvoices.length : 'NULL',
    chartData: chartData ? chartData.length : 'NULL',
    productSalesData: productSalesData ? productSalesData.length : 'NULL',
    visibleProducts: visibleProducts ? visibleProducts.size : 'NULL'
  });

  // DEBUGGING: Check for null arrays that should be empty arrays
  if (predictedOrders === null) {
    console.error('[RENDER ERROR] predictedOrders is NULL!');
    return <div>Error: predictedOrders is null</div>;
  }
  if (recentOrders === null) {
    console.error('[RENDER ERROR] recentOrders is NULL!');
    return <div>Error: recentOrders is null</div>;
  }
  if (historicalInvoices === null) {
    console.error('[RENDER ERROR] historicalInvoices is NULL!');
    return <div>Error: historicalInvoices is null</div>;
  }
  if (chartData === null) {
    console.error('[RENDER ERROR] chartData is NULL!');
    return <div>Error: chartData is null</div>;
  }
  if (productSalesData === null) {
    console.error('[RENDER ERROR] productSalesData is NULL!');
    return <div>Error: productSalesData is null</div>;
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
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {typeof callPrioritization.priorityScore === 'number' 
                        ? callPrioritization.priorityScore.toFixed(1) 
                        : parseFloat(callPrioritization.priorityScore || 0).toFixed(1)}
                    </Typography>
                    <Chip
                      label={
                        (() => {
                          // Calculate percentage position
                          const percentile = (callPrioritization.priorityScore / totalStores) * 100;
                          // Top 20% = High priority, Next 40% = Medium, Bottom 40% = Low
                          if (percentile <= 20) return 'High';
                          if (percentile <= 60) return 'Medium';
                          return 'Low';
                        })()
                      }
                      color={
                        (() => {
                          const percentile = (callPrioritization.priorityScore / totalStores) * 100;
                          if (percentile <= 20) return 'error';
                          if (percentile <= 60) return 'warning';
                          return 'default';
                        })()
                      }
                      size="small"
                    />
                  </Box>
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
                <Box mt={3}>
                  <Box display="flex" justifyContent="space-between" gap={1} mb={2}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<ArrowUpwardIcon />}
                      onClick={handleUpPriorityCall}
                      sx={{ flex: 1 }}
                    >
                      Up (Higher Priority)
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      endIcon={<ArrowDownwardIcon />}
                      onClick={handleDownPriorityCall}
                      sx={{ flex: 1 }}
                    >
                      Down (Lower Priority)
                    </Button>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<ShoppingCartIcon />}
                    onClick={handleCreateOrder}
                    fullWidth
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
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Predicted Orders" icon={<ShoppingCartIcon />} iconPosition="start" />
          <Tab label="Upselling" icon={<TipsIcon />} iconPosition="start" />
          <Tab label="Order History" icon={<CalendarIcon />} iconPosition="start" />
          <Tab label="Scan Orders" icon={<CloudUploadIcon />} iconPosition="start" />
        </Tabs>
        
        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Controls */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
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
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Sales Performance
                  </Typography>
                  <ToggleButtonGroup
                    value={timeWindow}
                    exclusive
                    onChange={(event, newValue) => {
                      if (newValue !== null) {
                        setTimeWindow(newValue);
                      }
                    }}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        px: 2,
                        py: 0.5,
                        textTransform: 'none'
                      }
                    }}
                  >
                    <ToggleButton value="week">Week</ToggleButton>
                    <ToggleButton value="month">Month</ToggleButton>
                    <ToggleButton value="quarter">Quarter</ToggleButton>
                    <ToggleButton value="year">Year</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                
                {!chartData || !Array.isArray(chartData) || chartData.length === 0 ? (
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
                        {(productSalesData || []).filter(p => visibleProducts && visibleProducts.has(p.productName)).map(product => (
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
                        {comparisonMode === 'yoy' && chartData && Array.isArray(chartData) && chartData.length > 12 && (
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
                        {(productSalesData || []).filter(p => visibleProducts && visibleProducts.has(p.productName)).map(product => (
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
                        {(productSalesData || []).filter(p => visibleProducts && visibleProducts.has(p.productName)).map(product => (
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
                        {(productSalesData || []).filter(p => visibleProducts && visibleProducts.has(p.productName)).map(product => (
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
                
                {productSalesData && Array.isArray(productSalesData) && productSalesData.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Products
                    </Typography>
                    <FormGroup>
                      {(productSalesData || []).map(product => (
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
                        ${chartData ? chartData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0).toFixed(2) : '0.00'}
                      </Typography>
                      {comparisonMode === 'yoy' && chartData && Array.isArray(chartData) && chartData.length > 12 && chartData[chartData.length - 13]?.totalRevenue > 0 && (
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
                        {chartData ? chartData.reduce((sum, d) => sum + (d.orderCount || 0), 0) : 0}
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
                        ${chartData && Array.isArray(chartData) && chartData.length > 0 ? (chartData.reduce((sum, d) => sum + (d.totalRevenue || 0), 0) / Math.max(1, chartData.reduce((sum, d) => sum + (d.orderCount || 0), 0))).toFixed(2) : '0.00'}
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
                        {chartData && Array.isArray(chartData) && chartData.length > 0 ? chartData.reduce((peak, d) => (d?.totalRevenue || 0) > (peak?.totalRevenue || 0) ? d : peak, chartData[0])?.date || 'N/A' : 'N/A'}
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

          {!predictedOrders || !Array.isArray(predictedOrders) || predictedOrders.length === 0 ? (
            <Alert severity="info">
              No predicted orders available for this store.
            </Alert>
          ) : (
            <Box>
              {(predictedOrders || []).map((order) => (
                <Card key={order.id} sx={{ mb: 3 }}>
                  <CardContent>
                    {/* Order Header */}
                    <Grid container spacing={2} alignItems="center" mb={2}>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Prediction Date
                        </Typography>
                        <Typography variant="h6">
                          {new Date(order.predictionDate).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Confidence Score
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6">
                            {((order.confidenceScore || 0) * 100).toFixed(1)}%
                          </Typography>
                          <Chip
                            label={
                              (order.confidenceScore || 0) >= 0.8 ? 'High' :
                              (order.confidenceScore || 0) >= 0.6 ? 'Medium' : 'Low'
                            }
                            color={
                              (order.confidenceScore || 0) >= 0.8 ? 'success' :
                              (order.confidenceScore || 0) >= 0.6 ? 'warning' : 'default'
                            }
                            size="small"
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Estimated Value
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {formatCurrency((order as any).estimatedValue || (order as any).estimated_value || 0)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={order.status}
                          color={
                            order.status === 'Completed' ? 'success' :
                            order.status === 'Confirmed' ? 'primary' :
                            order.status === 'Cancelled' ? 'error' :
                            'default'
                          }
                        />
                      </Grid>
                    </Grid>

                    {/* AI Prediction Analysis with Justification and Reasoning */}
                    {((order as any).justification || (order as any).reasoning || (order as any).ai_recommendation || order.notes) && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <AlertTitle>AI Prediction Analysis</AlertTitle>

                        {/* Justification - Why this prediction was made */}
                        {(order as any).justification && (
                          <Box mb={2}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Justification
                            </Typography>
                            <Typography variant="body2" paragraph>
                              {(order as any).justification}
                            </Typography>
                          </Box>
                        )}

                        {/* Reasoning - Step-by-step logic */}
                        {(order as any).reasoning && (
                          <Box mb={2}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Reasoning Process
                            </Typography>
                            <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
                              {(order as any).reasoning}
                            </Typography>
                          </Box>
                        )}

                        {/* Data Sources */}
                        {(order as any).data_sources && Array.isArray((order as any).data_sources) && (order as any).data_sources.length > 0 && (
                          <Box mb={2}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Data Sources
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1}>
                              {((order as any).data_sources || []).map((source: any, idx: number) => (
                                <Chip
                                  key={idx}
                                  label={`${source.type}: ${(source.weight * 100).toFixed(0)}%`}
                                  size="small"
                                  variant="outlined"
                                  color={source.weight > 0.3 ? "primary" : "default"}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Pattern Indicators */}
                        {(order as any).pattern_indicators && Array.isArray((order as any).pattern_indicators) && (order as any).pattern_indicators.length > 0 && (
                          <Box mb={2}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Pattern Indicators
                            </Typography>
                            {((order as any).pattern_indicators || []).map((pattern: any, idx: number) => (
                              <Box key={idx} display="flex" alignItems="center" gap={1} mb={0.5}>
                                <LinearProgress
                                  variant="determinate"
                                  value={pattern.strength * 100}
                                  sx={{ width: 100, height: 6 }}
                                  color={pattern.strength > 0.7 ? "success" : "warning"}
                                />
                                <Typography variant="caption">
                                  {pattern.pattern}: {pattern.description}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Legacy AI Recommendation field for backward compatibility */}
                        {!(order as any).justification && !(order as any).reasoning && ((order as any).ai_recommendation || order.notes) && (
                          <Typography variant="body2" paragraph>
                            <strong>AI Recommendation:</strong> {(order as any).ai_recommendation || order.notes}
                          </Typography>
                        )}

                        {/* Prediction Model */}
                        {(order as any).prediction_model && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Model: {(order as any).prediction_model}
                          </Typography>
                        )}
                      </Alert>
                    )}

                    {/* Predicted Items */}
                    {order.items && order.items.length > 0 && (
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Predicted Items ({order.items.length})
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Product Name</TableCell>
                                <TableCell align="center">Quantity</TableCell>
                                <TableCell align="right">Unit Price</TableCell>
                                <TableCell align="right">Total</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(order.items || []).map((item: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium">
                                      {item.name || item.productName || 'Unknown Product'}
                                    </Typography>
                                    {item.productId && (
                                      <Typography variant="caption" color="text.secondary">
                                        ID: {item.productId}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell align="center">
                                    <Typography variant="body2">
                                      {item.quantity || 0}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2">
                                      {formatCurrency(item.price || item.unitPrice || 0)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium">
                                      {formatCurrency((item.quantity || 0) * (item.price || item.unitPrice || 0))}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* Actions */}
                    <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleOrderClick(order.id)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<ShoppingCartIcon />}
                        onClick={() => navigate(`/orders/create/${order.id}`)}
                      >
                        Create Order from Prediction
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </TabPanel>
        
        {/* Order History Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Order History
          </Typography>
          
          {/* Recent Orders from Document Uploads */}
          {recentOrders && Array.isArray(recentOrders) && recentOrders.length > 0 && (
            <Box mb={4}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Recent Orders (From Document Uploads)
              </Typography>
              <TableContainer component={Paper} elevation={1}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><Typography variant="subtitle2">Order Number</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Date</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Customer</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Items</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Amount</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Source</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Status</Typography></TableCell>
                      <TableCell><Typography variant="subtitle2">Actions</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(recentOrders || []).map((order) => (
                      <TableRow 
                        key={order.id} 
                        hover 
                        onClick={() => navigate(`/orders/${order.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {order.order_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {order.customer_name || 'Document Upload Customer'}
                          </Typography>
                          {order.customer_phone && (
                            <Typography variant="caption" color="text.secondary">
                              {order.customer_phone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.item_count} items ({order.total_quantity} qty)
                        </TableCell>
                        <TableCell>
                          {formatCurrency(parseFloat(order.total_amount || '0'))}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={order.source === 'document' ? 'Document' : 'Manual'}
                            color={order.source === 'document' ? 'success' : 'primary'}
                            size="small"
                            icon={order.source === 'document' ? <DocumentIcon /> : undefined}
                          />
                          {order.extraction_confidence && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {(order.extraction_confidence * 100).toFixed(0)}% confidence
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={order.status || 'pending_review'}
                            color={
                              order.status === 'completed' ? 'success' : 
                              order.status === 'pending_review' ? 'warning' : 
                              'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(order);
                            }}
                            title="Delete Order"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* Historical Invoices */}
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              Historical Invoices
            </Typography>
            {!historicalInvoices || !Array.isArray(historicalInvoices) || historicalInvoices.length === 0 ? (
              <Alert severity="info">
                No historical invoices available for this store.
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
                  {(historicalInvoices || []).map((invoice) => (
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
          </Box>
        </TabPanel>

        {/* Scan Orders Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Upload Order Documents
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Upload scanned order forms, PDFs, or photos of orders. Our system will automatically extract the order information and convert it to a digital order form.
              </Typography>
            </Box>
            
            <DocumentUpload
              storeId={id}
              onUploadComplete={async (documentIds) => {
                console.log('Documents uploaded:', documentIds);
                // Optionally refresh or show success message
                // Could also navigate to a processing view
              }}
              onError={(error) => {
                console.error('Upload error:', error);
                // Show error notification
              }}
              maxFiles={10}
              showPreview={true}
              autoUpload={false}
            />
            
            {/* Recent Uploads Section */}
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Recent Document Uploads
              </Typography>
              <DocumentHistoryList storeId={id || ''} />
            </Box>
          </Box>
        </TabPanel>
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete Order
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete order {orderToDelete?.order_number || orderToDelete?.id?.slice(-8)}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDeleteOrder} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Document History Component with Classification Results
const DocumentHistoryList: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [processingResults, setProcessingResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [storeId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      
      // Load documents and processing results in parallel
      const [docsResponse, resultsResponse] = await Promise.all([
        documentApi.getStoreDocuments(storeId),
        documentApi.getStoreProcessingResults(storeId, undefined, 20, 0)
      ]);
      
      if (docsResponse.success) {
        setDocuments(docsResponse.data.documents || []);
      }
      
      if (resultsResponse.success) {
        setProcessingResults(resultsResponse.data.results || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProcessingResult = (documentId: string) => {
    return processingResults.find(r => r.document?.id === documentId);
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return 'success';
    if (quality >= 0.6) return 'warning';
    return 'error';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const handleViewDetails = async (documentId: string) => {
    setSelectedDocument(documentId);
    setDetailsOpen(true);
  };

  if (loading) {
    return <CircularProgress size={24} />;
  }

  if (documents.length === 0) {
    return (
      <Alert severity="info">
        No documents uploaded yet for this store.
      </Alert>
    );
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>File Name</TableCell>
              <TableCell>Upload Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Classification</TableCell>
              <TableCell>Quality</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(documents || []).map((doc) => {
              const result = getProcessingResult(doc.documentId);
              const classification = result?.classification;
              
              return (
                <TableRow key={doc.documentId}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <DocumentIcon fontSize="small" />
                      <Typography variant="body2">{doc.fileName}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.status}
                      size="small"
                      color={
                        doc.status === 'completed' ? 'success' :
                        doc.status === 'processing' ? 'primary' :
                        doc.status === 'failed' ? 'error' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {classification ? (
                      <Chip
                        label={classification.documentClass}
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {classification ? (
                      <Chip
                        label={`${(classification.quality * 100).toFixed(0)}%`}
                        size="small"
                        color={getQualityColor(classification.quality)}
                      />
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {classification ? (
                      <Chip
                        label={`${(classification.confidence * 100).toFixed(0)}%`}
                        size="small"
                        color={getConfidenceColor(classification.confidence)}
                      />
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {(doc.fileSize / 1024).toFixed(2)} KB
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      {doc.status === 'completed' && (
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(doc.documentId)}
                          title="View classification details"
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={async () => {
                          if (window.confirm('Delete this document?')) {
                            await documentApi.deleteDocument(doc.documentId);
                            loadDocuments();
                          }
                        }}
                        title="Delete document"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Classification Details Dialog */}
      {selectedDocument && (
        <ClassificationDetailsDialog
          documentId={selectedDocument}
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </>
  );
};

// Classification Details Dialog Component
const ClassificationDetailsDialog: React.FC<{
  documentId: string;
  open: boolean;
  onClose: () => void;
}> = ({ documentId, open, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (open && documentId) {
      loadDetails();
    }
  }, [open, documentId]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const response = await documentApi.getDocumentProcessingResult(documentId);
      if (response.success) {
        setResult(response.data);
      }
    } catch (error) {
      console.error('Error loading classification details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Document Classification Details</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : result ? (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Document Information
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="body2">
                  <strong>File:</strong> {result.document?.fileName}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> {result.document?.status}
                </Typography>
                {result.document?.processingTimeMs && (
                  <Typography variant="body2">
                    <strong>Processing Time:</strong> {(result.document.processingTimeMs / 1000).toFixed(2)}s
                  </Typography>
                )}
              </Box>
            </Grid>

            {result.classification && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Classification Results
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Document Type</Typography>
                      <Typography variant="h6">{result.classification.documentClass}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Quality Score</Typography>
                      <Typography variant="h6" color={
                        result.classification.quality >= 0.8 ? 'success.main' :
                        result.classification.quality >= 0.6 ? 'warning.main' : 'error.main'
                      }>
                        {(result.classification.quality * 100).toFixed(0)}%
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Confidence</Typography>
                      <Typography variant="h6" color={
                        result.classification.confidence >= 0.8 ? 'success.main' :
                        result.classification.confidence >= 0.6 ? 'warning.main' : 'error.main'
                      }>
                        {(result.classification.confidence * 100).toFixed(0)}%
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {result.classification.ocrEngine && (
                  <Box mt={2}>
                    <Typography variant="body2">
                      <strong>Recommended OCR Engine:</strong> {result.classification.ocrEngine}
                    </Typography>
                  </Box>
                )}

                {result.classification.preprocessingApplied && result.classification.preprocessingApplied.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Preprocessing Applied:</strong>
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {(result.classification.preprocessingApplied || []).map((op: string, index: number) => (
                        <Chip key={index} label={op} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>
            )}

            {result.confidenceScores && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Confidence Breakdown
                </Typography>
                {result.confidenceScores.factors && (
                  <Box display="flex" flexDirection="column" gap={1}>
                    {Object.entries(result.confidenceScores.factors || {}).map(([key, value]: [string, any]) => (
                      <Box key={key} display="flex" justifyContent="space-between">
                        <Typography variant="body2">{key.replace(/([A-Z])/g, ' $1').trim()}:</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {(Number(value) * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Grid>
            )}

            {result.validationErrors && result.validationErrors.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <AlertTitle>Validation Issues</AlertTitle>
                  <List dense>
                    {(result.validationErrors || []).map((error: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={error.field}
                          secondary={error.error}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              </Grid>
            )}
          </Grid>
        ) : (
          <Alert severity="error">Failed to load classification details</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {result?.document?.status === 'completed' && (
          <Button variant="contained" color="primary">
            Review Extracted Data
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default StoreDetailPage;
