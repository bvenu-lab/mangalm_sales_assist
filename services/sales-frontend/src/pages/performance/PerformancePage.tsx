import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatting';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Alert
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { SalesAgentPerformance } from '../../types/models';
import EnterpriseLineChart from '../../components/charts/EnterpriseLineChart';
import EnterpriseBarChart from '../../components/charts/EnterpriseBarChart';
import EnterprisePieChart from '../../components/charts/EnterprisePieChart';

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
      id={`performance-tabpanel-${index}`}
      aria-labelledby={`performance-tab-${index}`}
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

const PerformancePage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [performanceData, setPerformanceData] = useState<SalesAgentPerformance[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string>('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch performance data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        const response = await api.performance.getByPeriod(periodFilter as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly');
        setPerformanceData(response.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError('Failed to load performance data. Please try again later.');
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [periodFilter]);
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle period filter change
  const handlePeriodFilterChange = (event: SelectChangeEvent) => {
    setPeriodFilter(event.target.value);
  };
  
  // Calculate summary metrics
  const totalSales = performanceData.reduce((sum, item) => sum + item.totalSalesValue, 0);
  const totalCalls = performanceData.reduce((sum, item) => sum + item.callsCompleted, 0);
  const totalOrders = performanceData.reduce((sum, item) => sum + item.ordersPlaced, 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const avgUpsellRate = performanceData.length > 0 
    ? performanceData.reduce((sum, item) => sum + item.upsellSuccessRate, 0) / performanceData.length 
    : 0;
  
  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography color="error" variant="h6">{error}</Typography>
      </Box>
    );
  }
  
  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Performance Dashboard
        </Typography>
        <FormControl variant="outlined" sx={{ minWidth: 150 }}>
          <InputLabel id="period-filter-label">Time Period</InputLabel>
          <Select
            labelId="period-filter-label"
            id="period-filter"
            value={periodFilter}
            onChange={handlePeriodFilterChange}
            label="Time Period"
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9f9ff' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Total Sales
                </Typography>
                <MoneyIcon color="primary" fontSize="large" />
              </Box>
              <Typography variant="h3" color="primary" gutterBottom>
                {formatCurrency(totalSales)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {periodFilter === 'daily' ? 'Today' : 
                 periodFilter === 'weekly' ? 'This Week' : 
                 periodFilter === 'monthly' ? 'This Month' : 
                 periodFilter === 'quarterly' ? 'This Quarter' : 'This Year'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9fff9' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Avg Order Value
                </Typography>
                <BarChartIcon color="secondary" fontSize="large" />
              </Box>
              <Typography variant="h3" color="secondary" gutterBottom>
                {formatCurrency(avgOrderValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Per order average
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fffcf9' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Upsell Rate
                </Typography>
                <TrendingUpIcon color="success" fontSize="large" />
              </Box>
              <Typography variant="h3" color="success.main" gutterBottom>
                {(avgUpsellRate * 100).toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success rate for upsell attempts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Activity Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Calls Completed
                </Typography>
                <PersonIcon color="info" fontSize="large" />
              </Box>
              <Typography variant="h3" color="info.main" gutterBottom>
                {totalCalls}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total customer calls made
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Orders Placed
                </Typography>
                <TimelineIcon color="warning" fontSize="large" />
              </Box>
              <Typography variant="h3" color="warning.main" gutterBottom>
                {totalOrders}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total orders created
              </Typography>
            </CardContent>
          </Card>
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
          <Tab label="Performance Details" />
          <Tab label="Trends" />
        </Tabs>
        
        {/* Performance Details Tab */}
        <TabPanel value={tabValue} index={0}>
          {performanceData.length === 0 ? (
            <Alert severity="info">
              No performance data available for the selected period.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Typography variant="subtitle2">Date</Typography></TableCell>
                    <TableCell><Typography variant="subtitle2">Agent</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Calls</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Orders</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Upsell Rate</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Avg Order Value</Typography></TableCell>
                    <TableCell align="right"><Typography variant="subtitle2">Total Sales</Typography></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performanceData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {item.agentName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {item.callsCompleted}
                      </TableCell>
                      <TableCell align="right">
                        {item.ordersPlaced}
                      </TableCell>
                      <TableCell align="right">
                        {(item.upsellSuccessRate * 100).toFixed(1)}%
                        {item.upsellSuccessRate >= 0.5 ? (
                          <TrendingUpIcon fontSize="small" color="success" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                        ) : (
                          <TrendingDownIcon fontSize="small" color="error" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.averageOrderValue)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.totalSalesValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
        
        {/* Trends Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <EnterpriseLineChart
                data={performanceData.map(item => ({
                  x: new Date(item.date),
                  y: item.totalSalesValue,
                  label: new Date(item.date).toLocaleDateString()
                }))}
                title="Sales Trend"
                xLabel="Date"
                yLabel="Sales Value ($)"
                height={400}
                animate
                showTooltip
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EnterpriseBarChart
                data={performanceData.slice(0, 7).map(item => ({
                  label: item.agentName.split(' ')[0],
                  value: item.ordersPlaced,
                  subLabel: new Date(item.date).toLocaleDateString()
                }))}
                title="Orders by Agent"
                xLabel="Agent"
                yLabel="Orders"
                height={350}
                colorScheme="gradient"
                animate
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <EnterprisePieChart
                data={performanceData.slice(0, 5).map(item => ({
                  label: item.agentName,
                  value: item.totalSalesValue
                }))}
                title="Sales Distribution"
                height={350}
                donut
                animate
                interactive
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default PerformancePage;
