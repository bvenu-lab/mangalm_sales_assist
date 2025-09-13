import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  InputAdornment,
  Tooltip,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Store as StoreIcon,
  CalendarToday as CalendarIcon,
  LocalShipping as ShippingIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api, { PaginatedResponse } from '../../services/api';
import { Order, Store } from '../../types/models';
import { formatCurrency } from '../../utils/formatting';

// Define filter state interface
interface FilterState {
  search: string;
  storeId: string;
  status: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State for orders data
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  
  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // State for filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    storeId: '',
    status: '',
    dateFrom: null,
    dateTo: null,
    sortBy: 'order_date',
    sortOrder: 'desc'
  });
  
  // State for filter panel
  const [showFilters, setShowFilters] = useState(false);
  
  // Load initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch stores for filter dropdown
        const storesResponse = await api.store.getAll();
        const storesData = storesResponse.data?.data || [];
        setStores(storesData);
        
        // Fetch orders with current filters and pagination
        await fetchOrders();
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);
  
  // Fetch orders with current filters and pagination
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Prepare filter params
      const params = {
        page: page + 1, // API uses 1-based indexing
        pageSize: rowsPerPage,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search || undefined,
        storeId: filters.storeId || undefined,
        status: filters.status || undefined,
        dateFrom: filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : undefined,
        dateTo: filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : undefined
      };
      
      // Fetch orders
      const response = await api.order.getAll(params);

      if (response?.success === true) {
        setOrders(response.data || []);
        setTotalOrders(response.total || 0);
      } else {
        setOrders([]);
        setTotalOrders(0);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setLoading(false);
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (name: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('search', e.target.value);
  };
  
  // Handle store selection
  const handleStoreChange = (event: SelectChangeEvent) => {
    handleFilterChange('storeId', event.target.value);
  };
  
  // Handle status selection
  const handleStatusChange = (event: SelectChangeEvent) => {
    handleFilterChange('status', event.target.value);
  };
  
  // Handle date range selection
  const handleDateFromChange = (date: Date | null) => {
    handleFilterChange('dateFrom', date);
  };
  
  const handleDateToChange = (date: Date | null) => {
    handleFilterChange('dateTo', date);
  };
  
  // Handle sort changes
  const handleSortChange = (field: string) => {
    if (filters.sortBy === field) {
      // Toggle sort order if clicking the same field
      handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to descending
      setFilters(prev => ({
        ...prev,
        sortBy: field,
        sortOrder: 'desc'
      }));
    }
  };
  
  // Apply filters
  const applyFilters = () => {
    setPage(0); // Reset to first page when applying filters
    fetchOrders();
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      storeId: '',
      status: '',
      dateFrom: null,
      dateTo: null,
      sortBy: 'order_date',
      sortOrder: 'desc'
    });
    setPage(0);
  };
  
  // Handle pagination changes
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Effect to fetch orders when pagination or sort changes
  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, filters.sortBy, filters.sortOrder]);
  
  // Navigate to create new order
  const handleCreateOrder = () => {
    navigate('/orders/create');
  };
  
  // Navigate to view/edit order
  const handleViewOrder = (id: string) => {
    navigate(`/orders/${id}`);
  };
  
  // Navigate to store detail
  const handleViewStore = (id: string) => {
    navigate(`/stores/${id}`);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Get status chip color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'failed':
        return 'error';
      case 'draft':
        return 'info';
      default:
        return 'default';
    }
  };
  
  // Render loading state
  if (loading && orders.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Order History
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
      
      {/* Search and Filter Bar */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search orders by store name, order ID, etc."
              value={filters.search}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </Grid>
          <Grid item xs={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              onClick={resetFilters}
            >
              Reset
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
        
        {/* Advanced Filters */}
        {showFilters && (
          <Box mt={3}>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="store-select-label">Store</InputLabel>
                  <Select
                    labelId="store-select-label"
                    value={filters.storeId}
                    onChange={handleStoreChange}
                    label="Store"
                  >
                    <MenuItem value="">All Stores</MenuItem>
                    {stores.map(store => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="status-select-label">Status</InputLabel>
                  <Select
                    labelId="status-select-label"
                    value={filters.status}
                    onChange={handleStatusChange}
                    label="Status"
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="From Date"
                    value={filters.dateFrom}
                    onChange={handleDateFromChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        variant: 'outlined'
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="To Date"
                    value={filters.dateTo}
                    onChange={handleDateToChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        variant: 'outlined'
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>
      
      {/* Orders Table */}
      <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('id')}>
                    Order ID
                    {filters.sortBy === 'id' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('store_id')}>
                    Store
                    {filters.sortBy === 'store_id' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('order_date')}>
                    Order Date
                    {filters.sortBy === 'order_date' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('expectedDeliveryDate')}>
                    Delivery Date
                    {filters.sortBy === 'expectedDeliveryDate' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('status')}>
                    Status
                    {filters.sortBy === 'status' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => handleSortChange('total_amount')}>
                    Total
                    {filters.sortBy === 'total_amount' && (
                      <SortIcon sx={{ ml: 0.5, fontSize: 18, transform: filters.sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={40} />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="textSecondary">
                      No orders found matching your criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => handleViewOrder(String(order.id))}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {String(order.id).substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <StoreIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2">
                          {order.store_name || order.store?.name || 'Unknown Store'}
                        </Typography>
                        <IconButton 
                          size="small" 
                          sx={{ ml: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewStore(order.store_id);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {formatDate(order.order_date)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <ShippingIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          Not set
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        color={getStatusColor(order.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(parseFloat(order.total_amount || '0'))}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View/Edit Order">
                        <IconButton 
                          color="primary"
                          onClick={() => handleViewOrder(order.id)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalOrders}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default OrderHistoryPage;
