import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { Store } from '../../types/models';

const StoreListPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Stores state
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Fetch stores data
  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const response = await api.store.getAll();
        const storesData = response || [];
        setStores(storesData);
        setFilteredStores(storesData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch stores data. Please try again later.');
        setLoading(false);
        console.error('Error fetching stores:', err);
      }
    };

    fetchStores();
  }, []);
  
  // Get unique regions for filter
  const regions = React.useMemo(() => {
    const uniqueRegions = new Set<string>();
    stores.forEach(store => {
      if (store.region) {
        uniqueRegions.add(store.region);
      }
    });
    return Array.from(uniqueRegions).sort();
  }, [stores]);
  
  // Filter stores
  useEffect(() => {
    let filtered = [...stores];
    
    // Apply region filter
    if (regionFilter !== 'all') {
      filtered = filtered.filter(store => store.region === regionFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        store => 
          (store.name?.toLowerCase() || '').includes(lowercasedSearch) ||
          (store.city?.toLowerCase() || '').includes(lowercasedSearch) ||
          (store.region?.toLowerCase() || '').includes(lowercasedSearch) ||
          (store.contactPerson?.toLowerCase() || '').includes(lowercasedSearch) ||
          (store.phone?.toLowerCase() || '').includes(lowercasedSearch)
      );
    }
    
    setFilteredStores(filtered);
    setPage(0);
  }, [searchTerm, regionFilter, stores]);
  
  // Handle pagination
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle region filter change
  const handleRegionFilterChange = (event: SelectChangeEvent) => {
    setRegionFilter(event.target.value);
  };
  
  // Navigate to store detail
  const handleStoreClick = (storeId: string) => {
    navigate(`/stores/${storeId}`);
  };
  
  // Navigate to create store
  const handleCreateStore = () => {
    navigate('/stores/create');
  };
  
  // Navigate to edit store
  const handleEditStore = (e: React.MouseEvent, storeId: string) => {
    e.stopPropagation();
    navigate(`/stores/${storeId}/edit`);
  };
  
  // Open delete dialog
  const handleOpenDeleteDialog = (e: React.MouseEvent, store: Store) => {
    e.stopPropagation();
    setStoreToDelete(store);
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };
  
  // Close delete dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setStoreToDelete(null);
  };
  
  // Delete store
  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    
    try {
      setDeleteLoading(true);
      await api.store.delete(storeToDelete.id);
      
      // Remove store from state
      setStores(prevStores => prevStores.filter(store => store.id !== storeToDelete.id));
      
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setStoreToDelete(null);
    } catch (err) {
      console.error('Error deleting store:', err);
      setDeleteError('Failed to delete store. Please try again.');
      setDeleteLoading(false);
    }
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
          Stores
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateStore}
        >
          Add New Store
        </Button>
      </Box>
      
      {/* Store Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9f9ff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Stores
              </Typography>
              <Typography variant="h3" color="primary" gutterBottom>
                {stores.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active stores in the system
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9fff9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Regions
              </Typography>
              <Typography variant="h3" color="secondary" gutterBottom>
                {regions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unique regions with active stores
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fffcf9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Orders
              </Typography>
              <Typography variant="h3" color="success.main" gutterBottom>
                {/* Placeholder for average order value - would be calculated from historical invoices */}
                {Math.round(stores.reduce((sum, _store) => sum + 500, 0) / (stores.length || 1))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average order value across all stores
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Filters and Search */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search stores by name, location, or contact person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton onClick={() => setSearchTerm('')} edge="end">
                    &times;
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="region-filter-label">Region</InputLabel>
            <Select
              labelId="region-filter-label"
              id="region-filter"
              value={regionFilter}
              onChange={handleRegionFilterChange}
              label="Region"
            >
              <MenuItem value="all">All Regions</MenuItem>
              {regions.map(region => (
                <MenuItem key={region} value={region}>{region}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      {/* Stores Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><Typography variant="subtitle2">Store Name</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Location</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Contact Person</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Phone</Typography></TableCell>
                <TableCell align="center"><Typography variant="subtitle2">Orders</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Last Order</Typography></TableCell>
                <TableCell align="right"><Typography variant="subtitle2">Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body1" py={3}>
                      No stores found. Try a different search term or filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((store) => (
                    <TableRow 
                      key={store.id} 
                      hover 
                      onClick={() => handleStoreClick(store.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {store.name}
                        </Typography>
                        {store.storeSize && (
                          <Typography variant="body2" color="text.secondary">
                            {store.storeSize} size
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2">
                              {store.address}
                            </Typography>
                            <Typography variant="body2">
                              {store.city}{store.region ? `, ${store.region}` : ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {store.contactPerson || 'Not specified'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {store.phone || 'Not specified'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={store.orderCount ? "medium" : "normal"}>
                          {store.orderCount || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={store.lastOrderDate ? "text.primary" : "text.secondary"}>
                          {store.lastOrderDate 
                            ? new Date(store.lastOrderDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'No orders yet'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="primary" 
                          onClick={(e) => handleEditStore(e, store.id)}
                          title="Edit store"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          color="error" 
                          onClick={(e) => handleOpenDeleteDialog(e, store)}
                          title="Delete store"
                        >
                          <DeleteIcon />
                        </IconButton>
                        <IconButton 
                          color="primary" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStoreClick(store.id);
                          }}
                          title="View store details"
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredStores.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body1">
            Are you sure you want to delete the store "{storeToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            This action cannot be undone. All associated data will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteStore} 
            color="error" 
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StoreListPage;
