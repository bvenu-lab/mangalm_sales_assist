import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Store as StoreIcon,
  Phone as PhoneIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import apiGatewayClient from '../../services/api-gateway-client';
import { format } from 'date-fns';
import { 
  CallPrioritization, 
  Store, 
  PredictedOrder, 
  SalesAgentPerformance 
} from '../../types/models';
import { SkeletonDashboard } from '../../components/loading/LoadingSkeleton';
import EnterpriseLineChart from '../../components/charts/EnterpriseLineChart';
import EnterpriseBarChart from '../../components/charts/EnterpriseBarChart';

/**
 * DashboardPage component
 * 
 * This component provides the main dashboard for the application.
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<{
    callList: CallPrioritization[];
    recentStores: Store[];
    pendingOrders: PredictedOrder[];
    performance: SalesAgentPerformance | null;
  }>({
    callList: [],
    recentStores: [],
    pendingOrders: [],
    performance: null,
  });

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      console.log('[Dashboard] Starting to fetch dashboard data...');
      const startTime = Date.now();
      
      try {
        setLoading(true);
        setError(null);

        console.log('[Dashboard] Fetching prioritized call list...');
        // Fetch call list
        const callListResponse = await apiGatewayClient.get('/api/calls/prioritized?limit=5');
        console.log(`[Dashboard] Call list fetched: ${callListResponse.data?.length || 0} calls`);
        
        console.log('[Dashboard] Fetching recent stores...');
        // Fetch recent stores
        const recentStoresResponse = await apiGatewayClient.get('/api/stores/recent?limit=5');
        console.log(`[Dashboard] Recent stores fetched: ${recentStoresResponse.data?.length || 0} stores`);
        
        console.log('[Dashboard] Fetching pending orders...');
        // Fetch pending orders
        const pendingOrdersResponse = await apiGatewayClient.get('/api/orders/pending?limit=5');
        console.log(`[Dashboard] Pending orders fetched: ${pendingOrdersResponse.data?.length || 0} orders`);
        
        console.log('[Dashboard] Fetching performance summary...');
        // Fetch performance data
        const performanceResponse = await apiGatewayClient.get('/api/performance/summary');
        console.log('[Dashboard] Performance data fetched:', performanceResponse.data);

        // Set dashboard data
        const dashboardData = {
          callList: callListResponse.data || [],
          recentStores: recentStoresResponse.data || [],
          pendingOrders: pendingOrdersResponse.data || [],
          performance: performanceResponse.data || null,
        };
        
        console.log('[Dashboard] Setting dashboard data:', dashboardData);
        setDashboardData(dashboardData);
        
        const loadTime = Date.now() - startTime;
        console.log(`[Dashboard] Dashboard data loaded successfully in ${loadTime}ms`);
      } catch (error: any) {
        const loadTime = Date.now() - startTime;
        console.error(`[Dashboard] Failed to fetch dashboard data after ${loadTime}ms:`, {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
        console.log('[Dashboard] Loading state set to false');
      }
    };

    fetchDashboardData();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    console.log('[Dashboard] Refresh button clicked - reloading page');
    // Reload the dashboard data
    window.location.reload();
  };

  // Render loading state with skeleton
  if (loading) {
    return <SkeletonDashboard />;
  }

  // Render error state
  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Paper sx={{ p: 3, maxWidth: 500, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            {error}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRefresh}
            startIcon={<RefreshIcon />}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </Paper>
      </Box>
    );
  }

  // Calculate performance metrics
  const performanceData = dashboardData.performance;
  const performanceMetrics = [
    {
      label: 'Calls Completed',
      value: performanceData?.callsCompleted || 0,
      icon: <PhoneIcon />,
    },
    {
      label: 'Orders Placed',
      value: performanceData?.ordersPlaced || 0,
      icon: <ShoppingCartIcon />,
    },
    {
      label: 'Upsell Success Rate',
      value: `${((performanceData?.upsellSuccessRate || 0) * 100).toFixed(1)}%`,
      icon: <TrendingUpIcon />,
      trend: performanceData?.upsellSuccessRate && performanceData.upsellSuccessRate > 0.5 ? 'up' : 'down',
    },
    {
      label: 'Average Order Value',
      value: `$${(performanceData?.averageOrderValue || 0).toFixed(2)}`,
      icon: <ShoppingCartIcon />,
      trend: performanceData?.averageOrderValue && performanceData.averageOrderValue > 100 ? 'up' : 'down',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome message */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Welcome back, {user?.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Box>

      {/* Performance metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {performanceMetrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                    {metric.icon}
                  </Avatar>
                  {metric.trend && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {metric.trend === 'up' ? (
                        <ArrowUpwardIcon color="success" fontSize="small" />
                      ) : (
                        <ArrowDownwardIcon color="error" fontSize="small" />
                      )}
                    </Box>
                  )}
                </Box>
                <Typography variant="h4" component="div" sx={{ mt: 2, fontWeight: 'medium' }}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main content */}
      <Grid container spacing={3}>
        {/* Prioritized Call List */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Prioritized Call List"
              action={
                <Button
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/calls')}
                >
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List sx={{ width: '100%' }}>
                {dashboardData.callList.length > 0 ? (
                  dashboardData.callList.map((call) => (
                    <React.Fragment key={call.id}>
                      <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                          <Tooltip title="Call Store">
                            <IconButton edge="end" aria-label="call" onClick={() => navigate(`/stores/${call.storeId}`)}>
                              <PhoneIcon />
                            </IconButton>
                          </Tooltip>
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
                                Priority Score: {(call.priorityScore || 0).toFixed(1)}
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

        {/* Recent Stores */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Recent Stores"
              action={
                <Button
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/stores')}
                >
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List sx={{ width: '100%' }}>
                {dashboardData.recentStores.length > 0 ? (
                  dashboardData.recentStores.map((store) => (
                    <React.Fragment key={store.id}>
                      <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                          <Tooltip title="View Store">
                            <IconButton edge="end" aria-label="view" onClick={() => navigate(`/stores/${store.id}`)}>
                              <ArrowForwardIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            <StoreIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={store.name}
                          secondary={
                            <React.Fragment>
                              <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                              >
                                {store.city}{store.region ? `, ${store.region}` : ''}
                              </Typography>
                              {store.contactPerson && (
                                <Typography variant="body2" component="span">
                                  {' — '}{store.contactPerson}
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
                    <ListItemText primary="No recent stores available." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Orders */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Pending Orders"
              action={
                <Button
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/orders/history')}
                >
                  View All Orders
                </Button>
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List sx={{ width: '100%' }}>
                {dashboardData.pendingOrders.length > 0 ? (
                  dashboardData.pendingOrders.map((order) => (
                    <React.Fragment key={order.id}>
                      <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(`/orders/create/${order.storeId}?orderId=${order.id}`)}
                          >
                            Process Order
                          </Button>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'info.main' }}>
                            <ShoppingCartIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`Order for ${order.store?.name || 'Unknown Store'}`}
                          secondary={
                            <React.Fragment>
                              <Typography
                                sx={{ display: 'inline' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                              >
                                {order.predictionDate 
                                  ? `Predicted on ${format(new Date(order.predictionDate), 'MMM d, yyyy')}`
                                  : 'Prediction date not available'}
                              </Typography>
                              <Typography variant="body2" component="span">
                                {' — '}Confidence: {((order.confidenceScore || 0) * 100).toFixed(1)}%
                              </Typography>
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No pending orders at the moment." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;
