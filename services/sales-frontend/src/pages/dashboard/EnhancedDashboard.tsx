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
import { useAuth } from '../../contexts/AuthContext';
import apiGatewayClient from '../../services/api-gateway-client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import DocumentUpload from '../../components/documents/DocumentUpload';
import { documentApi } from '../../services/document-api';

// Product color palette for consistent visualization
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
  'Default': '#95A5A6',
};

const getProductColor = (productName: string): string => {
  const key = Object.keys(PRODUCT_COLORS).find(k => 
    productName.toUpperCase().includes(k)
  );
  return PRODUCT_COLORS[key as keyof typeof PRODUCT_COLORS] || PRODUCT_COLORS.Default;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  
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
        apiGatewayClient.get(`/api/analytics/trends?range=${selectedTimeRange}`).catch(() => ({ data: null })),
        apiGatewayClient.get('/api/analytics/product-distribution').catch(() => ({ data: null })),
        apiGatewayClient.get('/api/orders/recent?limit=10').catch(() => ({ data: null })),
      ]);

      // Extract data from Promise.allSettled results
      const getData = (result: any) => {
        if (result.status === 'fulfilled' && result.value?.data) {
          return result.value.data;
        }
        return null;
      };

      const callListData = getData(callListRes);
      const storesData = getData(storesRes);
      const ordersData = getData(ordersRes);
      const performanceData = getData(performanceRes);
      const trendsData = getData(trendsRes);
      const distributionData = getData(distributionRes);
      const recentOrdersData = getData(recentOrdersRes);

      // Process data for visualizations
      const processedData = processDataForVisualization(
        storesData || [],
        ordersData || [],
        trendsData,
        distributionData
      );

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
        callList: callListData || [],
        recentStores: storesData?.slice(0, 5) || [],
        pendingOrders: ordersData || [],
        recentOrders: recentOrders,
        performance: performanceData || null,
        allStores: storesData || [],
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
    // Handle null or undefined data - NO MOCK DATA GENERATION
    const validStores = stores || [];
    const validOrders = orders || [];
    
    // Product distribution by store - ONLY from real order data
    const productByStore = validStores.slice(0, 10).map(store => {
      const storeOrders = validOrders.filter((o: any) => o.store_id === store.id);
      const productCounts: Record<string, number> = {};
      
      // ONLY process real orders - no mock data
      if (storeOrders.length > 0) {
        storeOrders.forEach((order: any) => {
          order.items?.forEach((item: any) => {
            const productKey = item.product_name || item.productName;
            if (productKey) {
              productCounts[productKey] = (productCounts[productKey] || 0) + (parseFloat(item.quantity) || 0);
            }
          });
        });
      }

      const total = Object.values(productCounts).reduce((a, b) => a + b, 0);
      
      // Only return stores with actual order data
      return total > 0 ? {
        storeName: store.name,
        total,
        ...productCounts,
      } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.total - a.total);

    // Store performance trends - handle trends data properly (real data only)
    const storeTrends = trends?.data?.daily || trends?.daily || [];
    
    // Top products across all stores - ONLY from real order data
    const allProducts: Record<string, number> = {};
    
    validOrders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const productKey = item.product_name || item.productName;
          if (productKey) {
            allProducts[productKey] = (allProducts[productKey] || 0) + (parseFloat(item.quantity) || 0);
          }
        });
      }
    });

    // Convert to chart format - ONLY real products
    const topProducts = Object.entries(allProducts)
      .map(([name, value]) => ({ name, value, fill: getProductColor(name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      productByStore,
      storeTrends,
      topProducts,
      distribution: distribution?.data || distribution || {},
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

    // Document processing insight - this is always available
    insights.push({
      title: 'Upload Orders',
      value: 'Scan & Upload',
      severity: 'success',
      icon: <ScannerIcon />,
      recommendation: 'Upload order images for instant processing or bulk import CSV/Excel files.',
      action: {
        label: 'Upload Now',
        onClick: () => setShowUploadDialog(true),
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEnhancedDashboardData();
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
              Welcome back, {user?.name || 'Sales Agent'} • {format(new Date(), 'EEEE, MMMM d')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
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

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            title: 'Today\'s Revenue',
            value: '$12,456',
            change: 12.5,
            icon: <ShoppingCartIcon />,
            color: theme.palette.success.main,
          },
          {
            title: 'Orders Processed',
            value: '156',
            change: 8.3,
            icon: <DocumentIcon />,
            color: theme.palette.primary.main,
          },
          {
            title: 'Conversion Rate',
            value: '68%',
            change: -2.1,
            icon: <TrendingUpIcon />,
            color: theme.palette.warning.main,
          },
          {
            title: 'Avg Order Value',
            value: '$79.85',
            change: 5.7,
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
                    <Box display="flex" alignItems="center" mt={1}>
                      {metric.change > 0 ? (
                        <ArrowUpwardIcon fontSize="small" color="success" />
                      ) : (
                        <ArrowDownwardIcon fontSize="small" color="error" />
                      )}
                      <Typography
                        variant="body2"
                        color={metric.change > 0 ? 'success.main' : 'error.main'}
                      >
                        {Math.abs(metric.change)}%
                      </Typography>
                    </Box>
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
                                ${(parseFloat(order.total_amount || order.totalAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        {/* Product Distribution by Store */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader
              title="Product Distribution by Store"
              subheader="Quantity ordered per store with product breakdown"
              action={
                <IconButton onClick={() => navigate('/analytics')}>
                  <VisibilityIcon />
                </IconButton>
              }
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dashboardData.productByStore?.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.1)} />
                  <XAxis 
                    dataKey="storeName" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <ChartTooltip />
                  <Legend />
                  {dashboardData.topProducts?.slice(0, 8).map((product: any) => (
                    <Bar
                      key={product.name}
                      dataKey={product.name}
                      stackId="a"
                      fill={getProductColor(product.name)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products Pie Chart */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardHeader
              title="Top Products"
              subheader="Best selling products across all stores"
            />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={dashboardData.topProducts}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {dashboardData.topProducts?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
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
                  {['7d', '30d', '90d'].map(range => (
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
                  <Bar
                    yAxisId="left"
                    dataKey="target"
                    fill={alpha(theme.palette.success.main, 0.3)}
                    name="Target"
                  />
                </ComposedChart>
              </ResponsiveContainer>
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