import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Container,
  Grid,
  Typography,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  AlertTitle,
  Stack,
  LinearProgress,
  useTheme,
  alpha,
  Fab,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Visibility as VisibilityIcon,
  CloudUpload as CloudUploadIcon,
  Scanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Description as DocumentIcon,
  Analytics as AnalyticsIcon,
  AutoGraph as AutoGraphIcon,
  Insights as InsightsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Assessment as AssessmentIcon,
  FileUpload as FileUploadIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  TableChart as TableChartIcon,
  CloudQueue as CloudQueueIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
  Treemap,
  RadialBarChart,
  RadialBar,
  Sankey,
  Scatter,
  ScatterChart,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import apiGatewayClient from '../../services/api-gateway-client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import DocumentUpload from '../../components/documents/DocumentUpload';
import { documentApi } from '../../services/document-api';
import { formatCurrency } from '../../utils/formatting';

// Enhanced color palette for better pie chart visualization
const PIE_CHART_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Purple
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#F8B739', // Orange
  '#FF8C42', // Coral
  '#95A5A6', // Gray
  '#FD79A8', // Pink
  '#74B9FF', // Light Blue
  '#A29BFE', // Lavender
  '#55EFC4', // Aqua
];

// Product-specific colors for consistency
const PRODUCT_COLORS = {
  'BHEL PURI': '#FF6B6B',
  'SEV PURI': '#4ECDC4',
  'DAHI PURI': '#45B7D1',
  'PANI PURI': '#96CEB4',
  'SAMOSA': '#FFEAA7',
  'KACHORI': '#DDA0DD',
  'DHOKLA': '#98D8C8',
  'KHAMAN': '#F7DC6F',
  'FAFDA': '#F8B739',
  'JALEBI': '#FF8C42',
  'TASTY': '#FD79A8',
  'BOONDI': '#74B9FF',
  'KHATTA': '#A29BFE',
  'BUTTER': '#55EFC4',
  'Default': '#95A5A6',
};

const getProductColor = (productName: string, index?: number): string => {
  // First try to match specific product names
  const key = Object.keys(PRODUCT_COLORS).find(k =>
    productName.toUpperCase().includes(k)
  );

  if (key) {
    return PRODUCT_COLORS[key as keyof typeof PRODUCT_COLORS];
  }

  // If no match and index provided, use color from palette
  if (index !== undefined) {
    return PIE_CHART_COLORS[index % PIE_CHART_COLORS.length];
  }

  return PRODUCT_COLORS.Default;
};

interface InsightCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  icon: React.ReactNode;
  recommendation?: string;
}

const EnhancedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('180d');  // Default to 180d to ensure data is visible
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [productFilter, setProductFilter] = useState<string>('top-products');  // Filter for product/store views
  const [storeSegmentsData, setStoreSegmentsData] = useState<any>(null);  // Store segments data
  const [pieChartMode, setPieChartMode] = useState<'percentage' | 'quantity' | 'revenue'>('percentage');  // Pie chart display mode
  
  const [dashboardData, setDashboardData] = useState<any>({
    callList: [],
    recentStores: [],
    pendingOrders: [],
    performance: null,
    allStores: [],
    productDistribution: [],
    storeTrends: [],
    insights: [],
    alerts: [],
  });

  // Fetch enhanced dashboard data
  useEffect(() => {
    fetchEnhancedDashboardData();
  }, [selectedTimeRange]);
  
  // Fetch store segments when filter or time range changes
  useEffect(() => {
    fetchStoreSegments();
  }, [productFilter, selectedTimeRange]);

  const fetchEnhancedDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data with error handling for missing endpoints
      const [
        callListRes,
        storesRes,
        ordersRes,
        performanceRes,
        trendsRes,
        distributionRes,
        recentOrdersRes,
      ] = await Promise.allSettled([
        apiGatewayClient.get('/api/calls/prioritized?limit=10'),
        apiGatewayClient.get('/api/stores'),
        apiGatewayClient.get('/api/orders/pending?limit=10'),
        apiGatewayClient.get('/api/performance/summary'),
        apiGatewayClient.get(`/api/analytics/trends?range=${selectedTimeRange}`),
        apiGatewayClient.get(`/api/analytics/product-distribution?range=${selectedTimeRange}`),
        apiGatewayClient.get('/api/orders/recent?limit=10'),
      ]);

      // Extract data from Promise.allSettled results - allow some to fail
      const getData = (result: any, name: string, optional: boolean = false) => {
        console.log(`[getData] ${name} result:`, result);
        if (result.status === 'rejected') {
          console.error(`[getData] ${name} FAILED:`, result.reason);
          if (!optional) {
            throw new Error(`Failed to fetch ${name}: ${result.reason}`);
          }
          return null; // Return null for optional endpoints
        }
        if (result.status === 'fulfilled' && result.value?.data) {
          // Handle both { data: [...] } and { success: true, data: {...} } response formats
          const responseData = result.value.data;
          console.log(`[getData] ${name} response data:`, responseData);
          // If the response has a success flag and nested data, return the whole response
          if (responseData && typeof responseData === 'object' && 'success' in responseData) {
            return responseData;
          }
          return responseData;
        }
        console.error(`[getData] ${name} has no data in response:`, result);
        if (!optional) {
          throw new Error(`No data in ${name} response`);
        }
        return null;
      };

      // Mark some endpoints as optional so they don't break the whole dashboard
      const callListData = getData(callListRes, 'callList', true); // Optional
      const storesData = getData(storesRes, 'stores');
      const ordersData = getData(ordersRes, 'orders', true); // Optional
      const performanceData = getData(performanceRes, 'performance', true); // Optional
      const trendsData = getData(trendsRes, 'trends');
      const distributionData = getData(distributionRes, 'distribution');
      const recentOrdersData = getData(recentOrdersRes, 'recentOrders', true); // Optional

      console.log('[Dashboard] Distribution API response:', distributionData);

      // Process data for visualizations - provide defaults for empty database
      const processedData = processDataForVisualization(
        storesData || [],
        ordersData || [],
        trendsData || { data: { daily: [] } },
        distributionData || { data: { storeDistribution: [] } }
      );
      
      console.log('[Dashboard] Processed productByStore:', processedData.productByStore);

      // Generate insights
      const insights = generateInsights(processedData);
      
      // Generate alerts
      const alerts = generateAlerts(processedData);

      // Extract recent orders - handle both wrapped and unwrapped responses
      let recentOrders = [];
      if (recentOrdersData) {
        if (recentOrdersData.success && recentOrdersData.data) {
          // Response is wrapped in { success: true, data: [...] }
          recentOrders = recentOrdersData.data;
        } else if (Array.isArray(recentOrdersData)) {
          // Response is directly an array
          recentOrders = recentOrdersData;
        }
      }
      console.log('[EnhancedDashboard] Recent orders:', recentOrders.length, 'orders found');

      setDashboardData({
        callList: callListData, // NO FALLBACK
        recentStores: storesData ? storesData.slice(0, 5) : undefined, // NO FALLBACK
        pendingOrders: ordersData, // NO FALLBACK
        recentOrders: recentOrders,
        performance: performanceData, // NO FALLBACK
        allStores: storesData, // NO FALLBACK
        ...processedData,
        insights,
        alerts,
      });
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      setDashboardData((prev: any) => ({
        ...prev,
        recentOrders: prev.recentOrders.filter((o: any) => o.id !== orderToDelete.id)
      }));
      
      // Show success message (you can add a notification here)
      console.log('Order deleted successfully');
    } catch (error) {
      console.error('Failed to delete order:', error);
      setError('Failed to delete order. Please try again.');
    } finally {
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

  const processDataForVisualization = (stores: any[], orders: any[], trends: any, distribution: any) => {
    // Allow empty data - database was just cleared
    console.log('[processData] Input distribution:', distribution);
    console.log('[processData] Input stores:', stores?.length || 0, 'stores');
    console.log('[processData] Input orders:', orders?.length || 0, 'orders');
    
    // Product distribution by store - Use the actual distribution data from API
    let productByStore: any[] = [];
    let topProductsList: any[] = [];
    
    // First check if we have distribution data from the API
    // Handle both nested structures: distribution.data.storeDistribution and distribution.storeDistribution
    const storeDistribution = distribution?.data?.storeDistribution || distribution?.storeDistribution;
    const topProductsData = distribution?.data?.topProducts || distribution?.topProducts;
    
    if (storeDistribution && Array.isArray(storeDistribution)) {
      // Use the real distribution data from the API
      console.log('[processData] Found storeDistribution, count:', storeDistribution.length);
      productByStore = storeDistribution.map((store: any) => ({
        storeName: store.store_name || 'Unknown Store',
        total: parseInt(store.total_quantity) || 0,
        revenue: parseFloat(store.total_revenue) || 0,
        productCount: parseInt(store.product_count) || 0,
      }));
      console.log('[processData] Mapped productByStore:', productByStore);
    } else {
      console.log('[processData] No distribution data available (database may be empty)');
      console.log('[processData] distribution structure:', distribution);
      // Return empty array for charts to render empty state
      productByStore = [];
    }
    
    // Process top products from API
    if (topProductsData && Array.isArray(topProductsData)) {
      console.log('[processData] Found topProducts from API, count:', topProductsData.length);
      topProductsList = topProductsData;
    } else {
      console.log('[processData] No top products data available');
      topProductsList = [];
    }

    // Store performance trends - allow empty data
    const storeTrends = trends?.data?.daily || trends?.daily || [];
    console.log('[processData] Store trends:', storeTrends?.length || 0, 'records');
    
    // Use topProducts from API if available, otherwise try to extract from orders
    let topProducts: Array<{ name: string; value: number; revenue?: number; fill: string }> = [];

    // First, use the topProducts data from the API which has real data
    if (topProductsList && topProductsList.length > 0) {
      console.log('[processData] Using topProducts from API:', topProductsList.length);
      topProducts = topProductsList.map((product: any, index: number) => ({
        name: product.product_name || product.name,
        value: parseFloat(product.total_quantity || product.quantity || 0),
        revenue: parseFloat(product.total_revenue || 0),
        fill: getProductColor(product.product_name || product.name, index)
      })).slice(0, 10);
    } else if (orders && orders.length > 0) {
      // Fallback: try to extract from orders (though this usually won't have items)
      console.log('[processData] Falling back to extracting from orders');
      const allProducts: Record<string, number> = {};

      orders.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const productKey = item.product_name || item.productName;
            if (productKey) {
              const quantity = parseFloat(item.quantity);
              if (!isNaN(quantity)) {
                allProducts[productKey] = (allProducts[productKey] || 0) + quantity;
              }
            }
          });
        }
      });

      // Convert to chart format - ONLY real products
      topProducts = Object.entries(allProducts)
        .map(([name, value]) => ({ name, value, fill: getProductColor(name) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }

    console.log('[processData] Final topProducts for pie chart:', topProducts);

    return {
      productByStore,
      storeTrends,
      topProducts,
      topProductsList, // Add top products from API
      distribution: distribution, // NO FALLBACK
    };
  };

  const generateInsights = (data: any): InsightCard[] => {
    const insights: InsightCard[] = [];

    // Only generate insights based on REAL data
    // Top performing store insight - only if we have real order data
    if (data.productByStore?.length > 0) {
      const topStore = data.productByStore[0];
      insights.push({
        title: 'Top Performing Store',
        value: topStore.storeName,
        changeLabel: 'total orders: ' + topStore.total,
        severity: 'success',
        icon: <StoreIcon />,
        recommendation: `${topStore.storeName} has the highest order volume with ${topStore.total} items ordered.`,
        action: {
          label: 'View Details',
          onClick: () => navigate(`/stores/${topStore.id}`),
        },
      });
    }

    // Product trend insight - only if we have real product data
    if (data.topProducts?.length > 0) {
      const trendingProduct = data.topProducts[0];
      insights.push({
        title: 'Most Ordered Product',
        value: trendingProduct.name,
        changeLabel: `${trendingProduct.value} units ordered`,
        severity: 'info',
        icon: <TrendingUpIcon />,
        recommendation: `${trendingProduct.name} is the most ordered product with ${trendingProduct.value} units.`,
      });
    }

    // Single document upload insight
    insights.push({
      title: 'Quick Upload',
      value: 'Single Order',
      severity: 'success',
      icon: <ScannerIcon />,
      recommendation: 'Upload a single order document or photo for instant processing.',
      action: {
        label: 'Upload Now',
        onClick: () => setShowUploadDialog(true),
      },
    });

    // Bulk upload insight - prominently featured
    insights.push({
      title: 'Bulk Upload',
      value: 'Multiple Orders',
      severity: 'info',
      icon: <CloudUploadIcon />,
      recommendation: 'Process multiple order documents at once. Upload up to 20 files simultaneously for batch processing.',
      action: {
        label: 'Bulk Upload',
        onClick: () => setShowBulkUploadDialog(true),
      },
    });

    // CSV/Excel import insight
    insights.push({
      title: 'Import Data',
      value: 'CSV/Excel',
      severity: 'warning',
      icon: <TableChartIcon />,
      recommendation: 'Import historical orders from CSV or Excel files for analysis and predictions.',
      action: {
        label: 'Import File',
        onClick: () => navigate('/orders/import'),
      },
    });

    return insights;
  };

  const generateAlerts = (data: any): any[] => {
    const alerts = [];

    // Only generate alerts based on REAL data
    // Pending orders alert - only if there are actual pending orders
    if (data.pendingOrders?.length > 0) {
      alerts.push({
        severity: 'info',
        title: 'Pending Orders',
        message: `${data.pendingOrders.length} orders awaiting processing`,
        action: 'Process Orders',
      });
    }

    // Orders requiring review alert - check for document orders needing review
    const reviewNeeded = dashboardData.recentOrders?.filter((order: any) => 
      order.status === 'pending_review' || order.manual_verification_required
    )?.length || 0;

    if (reviewNeeded > 0) {
      alerts.push({
        severity: 'warning',
        title: 'Orders Need Review',
        message: `${reviewNeeded} uploaded orders require verification`,
        action: 'Review Orders',
      });
    }

    return alerts;
  };

  const fetchStoreSegments = async () => {
    try {
      const segment = productFilter === 'inactive-stores' ? 'inactive' :
                     productFilter === 'low-activity' ? 'low-activity' :
                     productFilter === 'high-performers' ? 'high-performers' : 'all';

      const response = await apiGatewayClient.get(`/api/analytics/store-segments-products?segment=${segment}&range=${selectedTimeRange}`);
      console.log('[fetchStoreSegments] API response:', response);
      // Extract the nested data.data property from response (the actual store data)
      setStoreSegmentsData(response?.data?.data || response?.data || response);
    } catch (error) {
      console.error('Failed to fetch store segments:', error);
      setStoreSegmentsData(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEnhancedDashboardData();
    fetchStoreSegments();
  };

  if (loading && !refreshing) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
          <Button onClick={handleRefresh} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header with Quick Actions */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Sales Command Center
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Welcome back, Sales Agent • {format(new Date(), 'EEEE, MMMM d')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
              <ToggleButtonGroup
                value={selectedTimeRange}
                exclusive
                onChange={(event, newRange) => {
                  if (newRange !== null) {
                    setSelectedTimeRange(newRange);
                  }
                }}
                size="small"
                sx={{ mr: 2 }}
              >
                <ToggleButton value="7d" aria-label="7 days">
                  7 Days
                </ToggleButton>
                <ToggleButton value="30d" aria-label="30 days">
                  30 Days
                </ToggleButton>
                <ToggleButton value="90d" aria-label="90 days">
                  90 Days
                </ToggleButton>
                <ToggleButton value="180d" aria-label="180 days">
                  180 Days
                </ToggleButton>
              </ToggleButtonGroup>
              <Button
                variant="contained"
                size="large"
                startIcon={<CloudUploadIcon />}
                onClick={() => setShowUploadDialog(true)}
                sx={{
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                }}
              >
                Scan Order
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PhoneIcon />}
                onClick={() => navigate('/calls')}
              >
                Start Calling
              </Button>
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Alerts Section */}
      {dashboardData.alerts?.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Stack spacing={2}>
            {dashboardData.alerts.map((alert: any, index: number) => (
              <Alert
                key={index}
                severity={alert.severity}
                action={
                  <Button color="inherit" size="small">
                    {alert.action}
                  </Button>
                }
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.message}
              </Alert>
            ))}
          </Stack>
        </Box>
      )}

      {/* Key Metrics - REAL DATA ONLY */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            title: dashboardData.performance?.mostRecentDate ? 
              `${new Date(dashboardData.performance.mostRecentDate).toLocaleDateString()} Revenue` : 
              'Latest Revenue',
            value: dashboardData.performance?.mostRecentDateRevenue ?
              formatCurrency(dashboardData.performance.mostRecentDateRevenue) : '$0.00',
            icon: <ShoppingCartIcon />,
            color: theme.palette.success.main,
          },
          {
            title: 'Orders Processed',
            value: dashboardData.performance?.ordersPlaced?.toString() || '0',
            icon: <DocumentIcon />,
            color: theme.palette.primary.main,
          },
          {
            title: 'Conversion Rate',
            value: dashboardData.performance?.ordersPlaced > 0 ?
              `${((dashboardData.performance.ordersPlaced / (dashboardData.performance.callsCompleted || 1)) * 100).toFixed(0)}%` : '0%',
            icon: <TrendingUpIcon />,
            color: theme.palette.warning.main,
          },
          {
            title: 'Avg Order Value',
            value: dashboardData.performance?.averageOrderValue ?
              formatCurrency(dashboardData.performance.averageOrderValue) : '$0.00',
            icon: <AssessmentIcon />,
            color: theme.palette.info.main,
          },
        ].map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${alpha(metric.color, 0.1)} 0%, ${alpha(metric.color, 0.05)} 100%)`,
                borderTop: `3px solid ${metric.color}`,
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {metric.title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {metric.value}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: metric.color, width: 56, height: 56 }}>
                    {metric.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Actionable Insights */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Actionable Insights"
              subheader="AI-powered recommendations to boost your sales"
              avatar={<InsightsIcon />}
            />
            <CardContent>
              <Grid container spacing={2}>
                {dashboardData.insights?.map((insight: InsightCard, index: number) => (
                  <Grid item xs={12} md={6} lg={3} key={index}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 2,
                        height: '100%',
                        transition: 'all 0.3s',
                        '&:hover': {
                          boxShadow: theme.shadows[4],
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <Box display="flex" alignItems="center" mb={1}>
                        <Avatar
                          sx={{
                            bgcolor: `${insight.severity}.light`,
                            color: `${insight.severity}.main`,
                            mr: 1,
                          }}
                        >
                          {insight.icon}
                        </Avatar>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {insight.title}
                        </Typography>
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {insight.value}
                      </Typography>
                      {insight.change && (
                        <Chip
                          size="small"
                          label={`${insight.change > 0 ? '+' : ''}${insight.change}% ${insight.changeLabel}`}
                          color={insight.change > 0 ? 'success' : 'error'}
                          sx={{ mb: 1 }}
                        />
                      )}
                      {insight.recommendation && (
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                          {insight.recommendation}
                        </Typography>
                      )}
                      {insight.action && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={insight.action.onClick}
                          fullWidth
                        >
                          {insight.action.label}
                        </Button>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Prioritized Call List */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Prioritized Call List"
              subheader="Stores requiring immediate attention"
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PhoneIcon />
                </Avatar>
              }
              action={
                <Button size="small" onClick={() => navigate('/calls')}>
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List sx={{ width: '100%' }}>
                {dashboardData.callList?.length > 0 ? (
                  dashboardData.callList.map((call: any) => (
                    <React.Fragment key={call.id}>
                      <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Store Details">
                              <IconButton 
                                edge="end" 
                                aria-label="view store" 
                                onClick={() => navigate(`/stores/${call.storeId}`)}
                                color="primary"
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={call.store?.phone ? "Call Store" : "No phone number available"}>
                              <span>
                                <IconButton 
                                  edge="end" 
                                  aria-label="call" 
                                  onClick={() => window.open(`tel:${call.store?.phone}`, '_self')}
                                  disabled={!call.store?.phone}
                                >
                                  <PhoneIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <StoreIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={call.store?.name || 'Unknown Store'}
                          secondary={
                            <React.Fragment>
                              <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                              >
                                Priority Score: {typeof call.priorityScore === 'number' ? call.priorityScore.toFixed(1) : parseFloat(call.priorityScore || 0).toFixed(1)}
                              </Typography>
                              {call.priorityReason && (
                                <Typography variant="body2" component="span">
                                  {' — '}{call.priorityReason}
                                </Typography>
                              )}
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No calls prioritized at the moment." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Recent Orders"
              subheader="Latest orders from your stores"
              avatar={
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <ShoppingCartIcon />
                </Avatar>
              }
              action={
                <Button size="small" onClick={() => navigate('/orders')}>
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List sx={{ width: '100%' }}>
                {dashboardData.recentOrders?.length > 0 ? (
                  dashboardData.recentOrders.slice(0, 5).map((order: any) => (
                    <React.Fragment key={order.id}>
                      <ListItem
                        secondaryAction={
                          <Box display="flex" gap={1}>
                            <Tooltip title="Delete Order">
                              <IconButton
                                edge="end"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOrder(order);
                                }}
                                size="small"
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        }
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: order.source === 'document' ? 'success.main' : 'primary.main' }}>
                            {order.source === 'document' ? <DocumentIcon /> : <ShoppingCartIcon />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" fontWeight="medium">
                              {order.order_number || `ORD-${order.id?.slice(-8) || 'UNKNOWN'}`}
                            </Typography>
                          }
                          secondary={
                            <React.Fragment>
                              <Typography component="span" variant="body2" color="text.primary">
                                {order.store?.name || order.storeName || 'Unknown Store'}
                              </Typography>
                              <br />
                              <Typography component="span" variant="body2" color="text.secondary">
                                {formatCurrency(parseFloat(order.total_amount || order.totalAmount || '0'))}
                                {' • '}
                                {order.customer_name || order.customerName || 'No customer'}
                              </Typography>
                            </React.Fragment>
                          }
                        />
                        <Chip
                          label={order.status || 'pending'}
                          size="small"
                          color={
                            order.status === 'pending_review' ? 'warning' :
                            order.status === 'completed' ? 'success' :
                            order.status === 'cancelled' ? 'error' : 'default'
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No recent orders." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Visualizations */}
      <Grid container spacing={3}>
        {/* Top Products & Store Activity */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">
                    Store Product Distribution
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={productFilter}
                      onChange={(e: SelectChangeEvent) => setProductFilter(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="top-products">Top Products</MenuItem>
                      <MenuItem value="inactive-stores">Inactive Stores (30+ days)</MenuItem>
                      <MenuItem value="low-activity">Low Activity Stores</MenuItem>
                      <MenuItem value="high-performers">High Performing Stores</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              }
              subheader={
                productFilter === 'top-products' ? 'Most frequently purchased products' :
                productFilter === 'inactive-stores' ? 'Stores that haven\'t ordered in 30+ days' :
                productFilter === 'low-activity' ? 'Stores with minimal product variety' : 
                'Top stores by product count and revenue'
              }
              action={
                <Stack direction="row" spacing={1}>
                  {['7d', '30d', '90d', '180d'].map(range => (
                    <Chip
                      key={range}
                      label={range}
                      onClick={() => setSelectedTimeRange(range)}
                      color={selectedTimeRange === range ? 'primary' : 'default'}
                      variant={selectedTimeRange === range ? 'filled' : 'outlined'}
                      size="small"
                    />
                  ))}
                  <IconButton onClick={() => navigate('/analytics')}>
                    <VisibilityIcon />
                  </IconButton>
                </Stack>
              }
            />
            <CardContent>
              {productFilter === 'top-products' && storeSegmentsData?.stores && storeSegmentsData.stores.length > 0 ? (
                <>
                  <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                    Stores showing top products distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={(() => {
                        // Transform data to show stores with their top products
                        const stores = storeSegmentsData.stores.slice(0, 10);
                        const topProducts = new Map<string, { name: string, color: string }>();

                        // Get top 5 most common products across all stores
                        const productCounts = new Map<string, number>();
                        stores.forEach((store: any) => {
                          store.products?.forEach((product: any) => {
                            const count = productCounts.get(product.product_name) || 0;
                            productCounts.set(product.product_name, count + product.quantity);
                          });
                        });

                        // Sort and get top 5 products
                        const sortedProducts = Array.from(productCounts.entries())
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5);

                        const colors = [
                          theme.palette.primary.main,
                          theme.palette.secondary.main,
                          theme.palette.success.main,
                          theme.palette.warning.main,
                          theme.palette.info.main
                        ];

                        sortedProducts.forEach(([name], index) => {
                          topProducts.set(name, { name, color: colors[index] });
                        });

                        // Transform stores data for stacked bar chart
                        return stores.map((store: any) => {
                          const storeData: any = {
                            store_name: store.store_name?.length > 20 ?
                              store.store_name.substring(0, 20) + '...' : store.store_name,
                            total_revenue: store.store_total_revenue
                          };

                          // Add top product quantities
                          store.products?.forEach((product: any) => {
                            if (topProducts.has(product.product_name)) {
                              storeData[product.product_name] = product.quantity;
                            }
                          });

                          return storeData;
                        });
                      })()}
                      margin={{ top: 20, right: 30, left: 60, bottom: 160 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                      <XAxis
                        dataKey="store_name"
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const total = payload.reduce((sum, item) => sum + (item.value || 0), 0);
                            return (
                              <Box sx={{ bgcolor: 'background.paper', p: 1, border: 1, borderColor: 'divider' }}>
                                <Typography variant="body2" fontWeight="bold">{label}</Typography>
                                <Divider sx={{ my: 0.5 }} />
                                {payload.map((item: any, index: number) => (
                                  <Typography key={index} variant="caption" display="block" style={{ color: item.fill }}>
                                    {item.name}: {item.value} units
                                  </Typography>
                                ))}
                                <Divider sx={{ my: 0.5 }} />
                                <Typography variant="caption" fontWeight="bold">
                                  Total: {total} units
                                </Typography>
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {(() => {
                        // Get the actual data that was prepared above
                        const chartData = (() => {
                          const stores = storeSegmentsData.stores.slice(0, 10);
                          const productCounts = new Map<string, number>();
                          stores.forEach((store: any) => {
                            store.products?.forEach((product: any) => {
                              const count = productCounts.get(product.product_name) || 0;
                              productCounts.set(product.product_name, count + product.quantity);
                            });
                          });
                          const sortedProducts = Array.from(productCounts.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5);
                          return stores.map((store: any) => {
                            const storeData: any = {
                              store_name: store.store_name?.length > 20 ?
                                store.store_name.substring(0, 20) + '...' : store.store_name,
                            };
                            store.products?.forEach((product: any) => {
                              if (sortedProducts.find(([name]) => name === product.product_name)) {
                                storeData[product.product_name] = product.quantity;
                              }
                            });
                            return storeData;
                          });
                        })();

                        // Extract unique product keys from actual chart data
                        const productKeys = new Set<string>();
                        chartData.forEach((store: any) => {
                          Object.keys(store).forEach(key => {
                            if (key !== 'store_name' && key !== 'total_revenue') {
                              productKeys.add(key);
                            }
                          });
                        });

                        const colors = [
                          theme.palette.primary.main,
                          theme.palette.secondary.main,
                          theme.palette.success.main,
                          theme.palette.warning.main,
                          theme.palette.info.main
                        ];

                        // Only create Bar components for products that exist in the data
                        return Array.from(productKeys).slice(0, 5).map((productName, index) => (
                          <Bar
                            key={productName}
                            dataKey={productName}
                            stackId="products"
                            fill={colors[index]}
                            name={productName.length > 30 ? productName.substring(0, 30) + '...' : productName}
                          />
                        ));
                      })()}
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : productFilter !== 'top-products' && storeSegmentsData?.stores && storeSegmentsData.stores.length > 0 ? (
                <>
                  {(() => {
                    // Prepare and validate data
                    const chartData = (() => {
                        // Transform the data to have stores with product breakdowns
                        const stores = storeSegmentsData?.stores || [];

                        // Filter out stores without products for low-activity view
                        const validStores = stores.filter((store: any) =>
                          store.products && store.products.length > 0
                        );

                        // If no valid stores, return empty array
                        if (validStores.length === 0) {
                          return [];
                        }

                        const allProducts = new Set<string>();

                        // Collect all unique products
                        validStores.forEach((store: any) => {
                          store.products?.forEach((product: any) => {
                            if (product.product_name && product.quantity != null) {
                              allProducts.add(product.product_name);
                            }
                          });
                        });

                        // Transform stores data for stacked bar chart
                        return validStores.slice(0, 10).map((store: any) => {
                          const storeData: any = {
                            store_name: store.store_name?.length > 20 ?
                              store.store_name.substring(0, 20) + '...' : store.store_name,
                            total_revenue: store.store_total_revenue || 0
                          };

                          // Add product quantities with validation
                          store.products?.forEach((product: any) => {
                            if (product.product_name && product.quantity != null) {
                              storeData[product.product_name] = product.quantity;
                            }
                          });

                          return storeData;
                        });
                      })();

                    // Only render chart if we have valid data
                    if (!chartData || chartData.length === 0) {
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                          <Typography color="textSecondary" variant="h6" gutterBottom>
                            {productFilter === 'inactive-stores' ? 'No Inactive Stores Found' :
                             productFilter === 'low-activity' ? 'No Low Activity Stores Found' :
                             'No High Performing Stores Found'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" textAlign="center" sx={{ mb: 2 }}>
                            {productFilter === 'inactive-stores' ? 'All stores have recent activity' :
                             productFilter === 'low-activity' ? 'All stores have good product variety' :
                             'Try adjusting the time range or upload more data'}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setProductFilter('top-products')}
                          >
                            View Top Products
                          </Button>
                        </Box>
                      );
                    }

                    return (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 60, bottom: 160 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="store_name"
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 10 }}
                        height={80}
                      />
                      <YAxis
                        label={{
                          value: 'Product Quantity',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 12 }
                        }}
                      />
                      <ChartTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const totalQuantity = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
                            return (
                              <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold">{label}</Typography>
                                <Divider sx={{ my: 0.5 }} />
                                {payload.map((entry: any, index: number) => (
                                  entry.value > 0 && (
                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 0.5 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Box sx={{ width: 10, height: 10, bgcolor: entry.color, mr: 1 }} />
                                        <Typography variant="caption">{entry.name}:</Typography>
                                      </Box>
                                      <Typography variant="caption" fontWeight="medium">
                                        {entry.value} units
                                      </Typography>
                                    </Box>
                                  )
                                ))}
                                <Divider sx={{ my: 0.5 }} />
                                <Typography variant="caption" fontWeight="bold">
                                  Total: {totalQuantity} units
                                </Typography>
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{
                          fontSize: '12px',
                          paddingTop: '20px',
                          bottom: 0
                        }}
                      />
                      {/* Dynamically create Bar components for each product */}
                      {(() => {
                        // Use the same chartData that was prepared above
                        const validStores = chartData || [];

                        // If no data, return empty array
                        if (validStores.length === 0) {
                          return null;
                        }

                        // Collect all product keys from the actual data
                        const productKeys = new Set<string>();
                        validStores.forEach((store: any) => {
                          Object.keys(store).forEach(key => {
                            // Exclude non-product keys
                            if (key !== 'store_name' && key !== 'total_revenue') {
                              productKeys.add(key);
                            }
                          });
                        });

                        // Convert to array and sort by some criteria
                        const products = Array.from(productKeys);

                        // Generate bars only for products that exist in the data
                        const colors = [
                          theme.palette.primary.main,
                          theme.palette.secondary.main,
                          theme.palette.success.main,
                          theme.palette.warning.main,
                          theme.palette.info.main,
                          theme.palette.error.main,
                        ];

                        return products.slice(0, 7).map((productName, index) => (
                          <Bar
                            key={productName}
                            dataKey={productName}
                            stackId="products"
                            fill={colors[index % colors.length]}
                            name={productName.length > 30 ? productName.substring(0, 30) + '...' : productName}
                          />
                        ));
                      })()}
                    </BarChart>
                  </ResponsiveContainer>
                    );
                  })()}
                </>
              ) : productFilter !== 'top-products' && (!storeSegmentsData?.stores || storeSegmentsData.stores.length === 0) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography color="textSecondary" variant="h6" gutterBottom>
                    {productFilter === 'inactive-stores' ? 'No Inactive Stores Found' :
                     productFilter === 'low-activity' ? 'No Low Activity Stores Found' :
                     'No High Performing Stores Found'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" textAlign="center" sx={{ mb: 2 }}>
                    {productFilter === 'inactive-stores' ? 'All stores have recent activity' :
                     productFilter === 'low-activity' ? 'All stores have good product variety' :
                     'Try adjusting the time range or upload more data'}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setProductFilter('top-products')}
                  >
                    View Top Products
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                  <Typography color="textSecondary" variant="h6">No Product Data Available</Typography>
                  <Typography color="textSecondary" variant="body2" sx={{ mt: 1 }}>Upload orders to see product distribution</Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<CloudUploadIcon />}
                    sx={{ mt: 2 }}
                    onClick={() => setShowUploadDialog(true)}
                  >
                    Upload Order
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products Pie Chart */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardHeader
              title="Top Products"
              subheader="Best selling products across all stores"
              action={
                <ToggleButtonGroup
                  value={pieChartMode}
                  exclusive
                  onChange={(event, newMode) => {
                    if (newMode !== null) {
                      setPieChartMode(newMode);
                    }
                  }}
                  size="small"
                  aria-label="pie chart display mode"
                >
                  <ToggleButton value="percentage" aria-label="percentage">
                    <Tooltip title="Show Percentage">
                      <span>%</span>
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="quantity" aria-label="quantity">
                    <Tooltip title="Show Quantity">
                      <span>#</span>
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="revenue" aria-label="revenue">
                    <Tooltip title="Show Revenue">
                      <span>$</span>
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              }
            />
            <CardContent>
              {(() => {
                console.log('[PieChart] dashboardData.topProducts:', dashboardData.topProducts);
                console.log('[PieChart] Display mode:', pieChartMode);
                return null;
              })()}
              {dashboardData.topProducts && dashboardData.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={dashboardData.topProducts}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey={pieChartMode === 'revenue' ? 'revenue' : 'value'}
                      label={({ name, percent, value, payload }) => {
                        if (pieChartMode === 'percentage') {
                          return `${name.length > 20 ? name.substring(0, 20) + '...' : name} ${((percent || 0) * 100).toFixed(0)}%`;
                        } else if (pieChartMode === 'quantity') {
                          return `${name.length > 20 ? name.substring(0, 20) + '...' : name} (${value})`;
                        } else {
                          // Revenue mode - convert INR to USD (assuming 1 USD = 83 INR)
                          const revenue = payload.revenue || value;
                          const revenueUSD = revenue / 83;
                          return `${name.length > 20 ? name.substring(0, 20) + '...' : name} $${(revenueUSD / 1000).toFixed(1)}K`;
                        }
                      }}
                      labelLine={false}
                    >
                      {dashboardData.topProducts?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value: number, name: string, props: any) => {
                        if (pieChartMode === 'revenue') {
                          // Convert INR to USD (1 USD = 83 INR)
                          const valueUSD = value / 83;
                          return [`$${valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                        } else if (pieChartMode === 'quantity') {
                          return [`${value} units`, name];
                        } else {
                          // For percentage mode, calculate the percent
                          const total = dashboardData.topProducts.reduce((sum: number, p: any) => sum + p.value, 0);
                          const percent = ((value / total) * 100).toFixed(1);
                          return [`${percent}%`, name];
                        }
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  height={400}
                  sx={{ color: 'text.secondary' }}
                >
                  <PieChartIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" gutterBottom>
                    No Product Data Available
                  </Typography>
                  <Typography variant="body2" textAlign="center">
                    Product distribution will appear here once orders are processed.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Store Performance Trends */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Store Performance Trends"
              subheader="7-day revenue and order trends"
              action={
                <Stack direction="row" spacing={1}>
                  {['7d', '30d', '90d', '180d'].map(range => (
                    <Chip
                      key={range}
                      label={range}
                      onClick={() => setSelectedTimeRange(range)}
                      color={selectedTimeRange === range ? 'primary' : 'default'}
                      variant={selectedTimeRange === range ? 'filled' : 'outlined'}
                    />
                  ))}
                </Stack>
              }
            />
            <CardContent>
              {dashboardData.storeTrends && dashboardData.storeTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={dashboardData.storeTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      fill={alpha(theme.palette.primary.main, 0.2)}
                      stroke={theme.palette.primary.main}
                      name="Revenue ($)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      stroke={theme.palette.secondary.main}
                      strokeWidth={2}
                      name="Orders"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <Box 
                  display="flex" 
                  flexDirection="column" 
                  alignItems="center" 
                  justifyContent="center" 
                  height={350}
                  sx={{ color: 'text.secondary' }}
                >
                  <BarChartIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" gutterBottom>
                    No Performance Data Available
                  </Typography>
                  <Typography variant="body2" textAlign="center">
                    Performance trends will appear here once orders are processed.
                    Upload order documents or create orders to see trends.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions & Upload Section */}
        <Grid item xs={12}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <CardHeader
              title="Quick Order Entry"
              subheader="Upload order documents for instant processing"
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <ScannerIcon />
                </Avatar>
              }
            />
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Typography variant="body1" gutterBottom>
                    Save time by uploading photos or scans of order forms. Our AI will automatically:
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {[
                      'Extract order details and product information',
                      'Identify store and customer details',
                      'Calculate totals and apply pricing',
                      'Create digital orders ready for processing',
                    ].map((feature, index) => (
                      <Box key={index} display="flex" alignItems="center">
                        <CheckCircleIcon fontSize="small" color="success" sx={{ mr: 1 }} />
                        <Typography variant="body2">{feature}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      startIcon={<CloudUploadIcon />}
                      onClick={() => setShowUploadDialog(true)}
                      sx={{
                        py: 2,
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                        boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                      }}
                    >
                      Upload Order Document
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      startIcon={<CameraIcon />}
                      onClick={() => setShowUploadDialog(true)}
                    >
                      Take Photo
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Document Upload Dialog */}
      {showUploadDialog && (
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 800,
            maxHeight: '80vh',
            overflow: 'auto',
            p: 4,
            zIndex: 1300,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Upload Order Documents
            </Typography>
            <IconButton onClick={() => setShowUploadDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <DocumentUpload
            requireStoreSelection={true}
            stores={dashboardData.allStores?.map((s: any) => ({
              id: s.id,
              name: s.name,
            }))}
            onUploadComplete={(documentIds) => {
              console.log('Documents uploaded:', documentIds);
              setShowUploadDialog(false);
              // Refresh dashboard
              fetchEnhancedDashboardData();
            }}
            maxFiles={10}
            autoUpload={false}
            enableOCR={true}
            showPreview={true}
          />
        </Paper>
      )}

      {/* Floating Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Quick actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
      >
        <SpeedDialAction
          icon={<CloudUploadIcon />}
          tooltipTitle="Upload Single Order"
          onClick={() => setShowUploadDialog(true)}
        />
        <SpeedDialAction
          icon={<TableChartIcon />}
          tooltipTitle="Bulk Upload CSV/XLSX"
          onClick={() => setShowBulkUploadDialog(true)}
        />
        <SpeedDialAction
          icon={<PhoneIcon />}
          tooltipTitle="Start Calling"
          onClick={() => navigate('/calls')}
        />
        <SpeedDialAction
          icon={<ShoppingCartIcon />}
          tooltipTitle="Create Order"
          onClick={() => navigate('/orders/create')}
        />
        <SpeedDialAction
          icon={<StoreIcon />}
          tooltipTitle="View Stores"
          onClick={() => navigate('/stores')}
        />
      </SpeedDial>

      {/* Bulk Upload Dialog */}
      <Dialog
        open={showBulkUploadDialog}
        onClose={() => setShowBulkUploadDialog(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="bulk-upload-dialog-title"
      >
        <DialogTitle id="bulk-upload-dialog-title">
          Bulk Upload Orders
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Upload multiple orders at once using CSV or XLSX files. Each row should represent one order with columns for order details.
          </DialogContentText>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Supported File Formats:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • CSV files (.csv)
              • Excel files (.xlsx, .xls)
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Required Columns:
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              • store_id - Store identifier<br/>
              • customer_name - Customer full name<br/>
              • customer_phone - Customer phone number<br/>
              • items - JSON array of order items<br/>
              • total_amount - Order total amount
            </Typography>
          </Box>

          <input
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            id="bulk-upload-file-input"
            type="file"
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                // Handle bulk file upload here
                console.log('Bulk files selected:', files);
                // TODO: Implement bulk upload processing
                setShowBulkUploadDialog(false);
              }
            }}
          />
          <label htmlFor="bulk-upload-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudQueueIcon />}
              fullWidth
              size="large"
              sx={{ p: 2, borderStyle: 'dashed' }}
            >
              Choose CSV/XLSX Files
            </Button>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkUploadDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<TableChartIcon />}
            onClick={() => {
              // Trigger file input click
              document.getElementById('bulk-upload-file-input')?.click();
            }}
          >
            Browse Files
          </Button>
        </DialogActions>
      </Dialog>

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
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete order {orderToDelete?.order_number || orderToDelete?.id?.slice(-8)}?
            This action cannot be undone.
          </DialogContentText>
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

    </Container>
  );
};

export default EnhancedDashboard;