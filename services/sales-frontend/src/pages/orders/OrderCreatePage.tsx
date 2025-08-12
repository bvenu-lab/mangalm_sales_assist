import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Divider,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  InputAdornment,
  SelectChangeEvent,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
  Store as StoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import api from '../../services/api';
import apiGatewayClient from '../../services/api-gateway-client';
import { Store, Product, PredictedOrder, PredictedOrderItem } from '../../types/models';

// Define interfaces for form data
interface OrderFormData {
  storeId: string;
  orderDate: string;
  deliveryDate: string;
  notes: string;
  status: 'Draft' | 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  items: OrderItemFormData[];
}

interface OrderItemFormData {
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  notes: string;
  product?: Product;
}

// Extended PredictedOrder interface with additional fields needed for the form
interface ExtendedPredictedOrder extends PredictedOrder {
  expectedDeliveryDate?: string;
  confidence?: number;
  aiRecommendation?: string;
}

// Extended PredictedOrderItem interface with additional fields needed for the form
interface ExtendedPredictedOrderItem extends PredictedOrderItem {
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  notes?: string;
}

// Upselling suggestion interface
interface UpsellingSuggestion {
  productId: string;
  productName: string;
  category?: string;
  brand?: string;
  unitPrice: number;
  suggestedQuantity: number;
  confidence: number;
  justification: string;
  expectedRevenue: number;
}

const OrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const queryParams = new URLSearchParams(location.search);
  const storeIdFromQuery = queryParams.get('storeId');
  
  // State for form data
  const [formData, setFormData] = useState<OrderFormData>({
    storeId: storeIdFromQuery || '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    status: 'Draft',
    items: []
  });
  
  // State for validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // State for data loading
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [predictedOrder, setPredictedOrder] = useState<ExtendedPredictedOrder | null>(null);
  const [upsellingSuggestions, setUpsellingSuggestions] = useState<UpsellingSuggestion[]>([]);
  const [tabValue, setTabValue] = useState(0);
  
  // State for product search
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  
  // State for product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productDiscount, setProductDiscount] = useState(0);
  const [productNotes, setProductNotes] = useState('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  
  // State for notifications
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  
  // State for confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // Load initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch stores
        const storesResponse = await api.store.getAll();
        const storesData = storesResponse.data?.data || [];
        setStores(storesData);
        
        // Fetch products
        const productsResponse = await api.product.getAll();
        const productsData = productsResponse.data?.data || [];
        setProducts(productsData);
        setFilteredProducts(productsData);
        
        // If editing an existing order
        if (id) {
          const orderResponse = await api.predictedOrder.getById(id);
          const orderData: any = orderResponse.data;
          
          console.log('[OrderCreatePage] Loaded order data:', orderData);
          
          if (orderData) {
            // Find the store
            const store = storesData.find((s: Store) => s.id === orderData.storeId);
            setSelectedStore(store || null);
            
            // Get the date field - API might return different field names
            const orderDate = orderData.predictionDate || orderData.predictedDate || orderData.orderDate || orderData.prediction_date;
            const deliveryDate = orderData.expectedDeliveryDate || orderData.deliveryDate;
            
            // Set form data with defensive date parsing
            setFormData({
              storeId: orderData.storeId || orderData.store_id,
              orderDate: orderDate ? new Date(orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              deliveryDate: deliveryDate 
                ? new Date(deliveryDate).toISOString().split('T')[0]
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: orderData.notes || orderData.aiRecommendation || '',
              status: orderData.status === 'Predicted' || orderData.status === 'pending' ? 'Draft' : (orderData.status === 'Confirmed' ? 'Confirmed' : 'Completed'),
              items: orderData.items?.map((item: PredictedOrderItem) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.actualQuantity || item.suggestedQuantity,
                unitPrice: (item as ExtendedPredictedOrderItem).unitPrice || 
                  (productsData.find((p: Product) => p.id === item.productId)?.unitPrice || 0),
                discount: (item as ExtendedPredictedOrderItem).discount || 0,
                notes: (item as ExtendedPredictedOrderItem).notes || '',
                product: productsData.find((p: Product) => p.id === item.productId)
              })) || []
            });
            
            setPredictedOrder({
              ...orderData,
              aiRecommendation: orderData.aiRecommendation || orderData.notes
            } as ExtendedPredictedOrder);
            
            // Fetch upselling suggestions for this order
            try {
              const upsellingResponse = await apiGatewayClient.get(`/api/upselling/suggestions/${id}`);
              if (upsellingResponse.data) {
                setUpsellingSuggestions(upsellingResponse.data);
              }
            } catch (err) {
              console.error('Error fetching upselling suggestions:', err);
            }
          }
        } 
        // If creating a new order with a store ID
        else if (storeIdFromQuery) {
          const store = storesData.find((s: Store) => s.id === storeIdFromQuery);
          setSelectedStore(store || null);
          
          // Fetch upselling suggestions for this store
          try {
            const upsellingResponse = await apiGatewayClient.get(`/api/upselling/store/${storeIdFromQuery}`);
            if (upsellingResponse.data) {
              setUpsellingSuggestions(upsellingResponse.data);
            }
          } catch (err) {
            console.error('Error fetching store upselling suggestions:', err);
          }
          
          // Check if there's a predicted order for this store
          try {
            const predictedOrdersResponse = await api.predictedOrder.getByStore(storeIdFromQuery);
            const predictedOrders = predictedOrdersResponse.data?.data || [];
            
            // Use the most recent predicted order that's not completed
            const latestPrediction = predictedOrders
              .filter((order: PredictedOrder) => order.status !== 'Completed' && order.status !== 'Cancelled')
              .sort((a: PredictedOrder, b: PredictedOrder) => new Date(b.predictionDate).getTime() - new Date(a.predictionDate).getTime())[0];
            
            if (latestPrediction) {
              setPredictedOrder(latestPrediction);
              
              // Ask user if they want to use the predicted order
              setConfirmMessage(`We found a predicted order for ${store?.name} with ${latestPrediction.items?.length || 0} items. Would you like to use this as a starting point?`);
              setConfirmAction(() => () => {
                // Set form data from predicted order
                setFormData(prev => ({
                  ...prev,
                  items: latestPrediction.items?.map((item: PredictedOrderItem) => ({
                    productId: item.productId,
                    quantity: item.actualQuantity || item.suggestedQuantity,
                    unitPrice: (item as ExtendedPredictedOrderItem).unitPrice || 
                      (productsData.find((p: Product) => p.id === item.productId)?.unitPrice || 0),
                    discount: (item as ExtendedPredictedOrderItem).discount || 0,
                    notes: (item as ExtendedPredictedOrderItem).notes || '',
                    product: productsData.find((p: Product) => p.id === item.productId)
                  })) || []
                }));
              });
              setConfirmDialogOpen(true);
            }
          } catch (err) {
            console.error('Error fetching predicted orders:', err);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setNotification({
          open: true,
          message: 'Failed to load data. Please try again.',
          severity: 'error'
        });
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [id, storeIdFromQuery]);
  
  // Filter products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const searchTermLower = productSearchTerm.toLowerCase();
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(searchTermLower) ||
        product.sku?.toLowerCase().includes(searchTermLower) ||
        product.category?.toLowerCase().includes(searchTermLower)
      );
      setFilteredProducts(filtered);
    }
  }, [productSearchTerm, products]);
  
  // Handle store selection
  const handleStoreChange = (event: SelectChangeEvent) => {
    const storeId = event.target.value;
    setFormData(prev => ({ ...prev, storeId }));
    
    const store = stores.find((s: Store) => s.id === storeId);
    setSelectedStore(store || null);
    
    // Clear validation error
    if (errors.storeId) {
      setErrors(prev => ({ ...prev, storeId: '' }));
    }
  };
  
  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  // Handle status change
  const handleStatusChange = (event: SelectChangeEvent) => {
    const status = event.target.value as OrderFormData['status'];
    setFormData(prev => ({ ...prev, status }));
  };
  
  // Open product dialog for adding a new item
  const handleAddProduct = () => {
    setSelectedProduct(null);
    setProductQuantity(1);
    setProductDiscount(0);
    setProductNotes('');
    setEditingItemIndex(null);
    setProductDialogOpen(true);
  };
  
  // Open product dialog for editing an existing item
  const handleEditItem = (index: number) => {
    const item = formData.items[index];
    setSelectedProduct(item.product || null);
    setProductQuantity(item.quantity);
    setProductDiscount(item.discount);
    setProductNotes(item.notes);
    setEditingItemIndex(index);
    setProductDialogOpen(true);
  };
  
  // Remove an item from the order
  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };
  
  // Handle product selection in dialog
  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
  };
  
  // Handle quantity change in dialog
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setProductQuantity(isNaN(value) || value < 1 ? 1 : value);
  };
  
  // Handle discount change in dialog
  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setProductDiscount(isNaN(value) || value < 0 ? 0 : value > 100 ? 100 : value);
  };
  
  // Handle notes change in dialog
  const handleProductNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProductNotes(e.target.value);
  };
  
  // Add or update product in order
  const handleAddOrUpdateProduct = () => {
    if (!selectedProduct) return;
    
    const newItem: OrderItemFormData = {
      productId: selectedProduct.id,
      quantity: productQuantity,
      unitPrice: selectedProduct.unitPrice || selectedProduct.price || 0,
      discount: productDiscount,
      notes: productNotes,
      product: selectedProduct
    };
    
    if (editingItemIndex !== null) {
      // Update existing item
      setFormData(prev => ({
        ...prev,
        items: prev.items.map((item, i) => i === editingItemIndex ? newItem : item)
      }));
    } else {
      // Add new item
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
    
    setProductDialogOpen(false);
  };
  
  // Close product dialog
  const handleCloseProductDialog = () => {
    setProductDialogOpen(false);
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };
  
  // Handle confirmation dialog
  const handleConfirmDialogClose = (confirmed: boolean) => {
    setConfirmDialogOpen(false);
    if (confirmed) {
      confirmAction();
    }
  };
  
  // Calculate order totals
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const discountAmount = (itemTotal * item.discount) / 100;
      return sum + (itemTotal - discountAmount);
    }, 0);
    
    const itemCount = formData.items.reduce((sum, item) => sum + item.quantity, 0);
    
    return { subtotal, itemCount };
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.storeId) {
      newErrors.storeId = 'Please select a store';
    }
    
    if (!formData.orderDate) {
      newErrors.orderDate = 'Order date is required';
    }
    
    if (!formData.deliveryDate) {
      newErrors.deliveryDate = 'Delivery date is required';
    } else if (new Date(formData.deliveryDate) < new Date(formData.orderDate)) {
      newErrors.deliveryDate = 'Delivery date must be after order date';
    }
    
    if (formData.items.length === 0) {
      newErrors.items = 'Please add at least one product to the order';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      
      // Map form status to PredictedOrder status
      let orderStatus: 'Predicted' | 'Confirmed' | 'Completed' | 'Cancelled';
      switch (formData.status) {
        case 'Draft':
        case 'Pending':
          orderStatus = 'Predicted';
          break;
        case 'Confirmed':
          orderStatus = 'Confirmed';
          break;
        case 'Completed':
          orderStatus = 'Completed';
          break;
        case 'Cancelled':
          orderStatus = 'Cancelled';
          break;
        default:
          orderStatus = 'Predicted';
      }
      
      // Map form items to PredictedOrderItem format
      const mappedItems = formData.items.map(item => ({
        id: item.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        productId: item.productId,
        suggestedQuantity: item.quantity,
        actualQuantity: item.quantity,
        isUpsell: false,
        predictedOrderId: id || '',
        notes: item.notes,
        unitPrice: item.unitPrice,
        discount: item.discount
      }));
      
      const orderData = {
        storeId: formData.storeId,
        status: orderStatus,
        predictionDate: formData.orderDate,
        expectedDeliveryDate: formData.deliveryDate,
        totalAmount: calculateTotals().subtotal,
        notes: formData.notes,
        items: mappedItems
      };
      
      let response;
      
      if (id) {
        // Update existing order
        response = await api.predictedOrder.update(id, orderData);
      } else {
        // Create new order
        response = await api.predictedOrder.create(orderData);
      }
      
      setSubmitting(false);
      
      if (response.data) {
        setNotification({
          open: true,
          message: `Order ${id ? 'updated' : 'created'} successfully`,
          severity: 'success'
        });
        
        // Navigate back to store detail or order history
        setTimeout(() => {
          if (formData.storeId) {
            navigate(`/stores/${formData.storeId}`);
          } else {
            navigate('/orders');
          }
        }, 1500);
      } else {
        throw new Error('Failed to save order');
      }
    } catch (err) {
      console.error('Error saving order:', err);
      setNotification({
        open: true,
        message: `Failed to ${id ? 'update' : 'create'} order. Please try again.`,
        severity: 'error'
      });
      setSubmitting(false);
    }
  };
  
  // Navigate back
  const handleBack = () => {
    if (formData.storeId) {
      navigate(`/stores/${formData.storeId}`);
    } else {
      navigate('/orders');
    }
  };
  
  // Calculate totals
  const { subtotal, itemCount } = calculateTotals();
  
  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }
  
  // Simplified render to fix TypeScript errors
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        {id ? 'Edit Predicted Order' : 'Create New Order'}
      </Typography>
      
      {/* Main Form Content */}
      <Grid container spacing={3}>
        {/* Store Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Store *</InputLabel>
            <Select
              value={formData.storeId}
              onChange={(e) => {
                const storeId = e.target.value;
                setFormData(prev => ({ ...prev, storeId }));
                const store = stores.find(s => s.id === storeId);
                setSelectedStore(store || null);
              }}
              disabled={loading || !!id}
              label="Store *"
            >
              {stores.map(store => (
                <MenuItem key={store.id} value={store.id}>
                  {store.name} - {store.city}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Order Date */}
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            margin="normal"
            type="date"
            label="Order Date"
            value={formData.orderDate}
            onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>

        {/* Delivery Date */}
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            margin="normal"
            type="date"
            label="Expected Delivery"
            value={formData.deliveryDate}
            onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>

        {/* Store Details */}
        {selectedStore && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Store Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Contact Person</Typography>
                  <Typography>{selectedStore.contactPerson || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Phone</Typography>
                  <Typography>{selectedStore.phone || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Email</Typography>
                  <Typography>{selectedStore.email || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Predicted Order Info with Tabs */}
        {(predictedOrder || upsellingSuggestions.length > 0) && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
                <Tab label="AI Predicted Items" />
                <Tab label="Upselling Opportunities" />
              </Tabs>
              
              {/* AI Predicted Items Tab */}
              {tabValue === 0 && predictedOrder && (
                <Box>
                  <Grid container spacing={2} mb={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">Confidence Score</Typography>
                      <Typography variant="h6">
                        {((predictedOrder.confidence || predictedOrder.confidenceScore || 0) * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Typography variant="body2" color="text.secondary">AI Recommendation</Typography>
                      <Typography variant="body1">
                        {predictedOrder.aiRecommendation || 'Based on historical ordering patterns'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {predictedOrder.items && predictedOrder.items.length > 0 && (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Product ID</TableCell>
                            <TableCell>Product Name</TableCell>
                            <TableCell>Justification</TableCell>
                            <TableCell align="center">Suggested Qty</TableCell>
                            <TableCell align="right">Unit Price</TableCell>
                            <TableCell align="center">Confidence</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {predictedOrder.items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                              <TableRow key={index}>
                                <TableCell>
                                  <Typography variant="body2" fontFamily="monospace">
                                    {item.productId}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {product?.name || (item as any).productName || (item as any).name || 'Unknown Product'}
                                  </Typography>
                                  {product?.sku && (
                                    <Typography variant="caption" color="text.secondary">
                                      SKU: {product.sku}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {(item as any).justification || 'Based on historical ordering patterns'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  {item.suggestedQuantity || item.quantity}
                                </TableCell>
                                <TableCell align="right">
                                  ${(product?.unitPrice || product?.price || 0).toFixed(2)}
                                </TableCell>
                                <TableCell align="center">
                                  <Chip 
                                    label={`${((item.confidenceScore || 0.7) * 100).toFixed(0)}%`}
                                    size="small"
                                    color={(item.confidenceScore || 0.7) > 0.7 ? 'success' : 'default'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                      if (product) {
                                        setFormData(prev => ({
                                          ...prev,
                                          items: [...prev.items, {
                                            productId: item.productId,
                                            quantity: item.suggestedQuantity || item.quantity || 1,
                                            unitPrice: product.unitPrice || product.price || 0,
                                            discount: 0,
                                            notes: '',
                                            product
                                          }]
                                        }));
                                      }
                                    }}
                                    disabled={formData.items.some(i => i.productId === item.productId)}
                                  >
                                    Add
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
              
              {/* Upselling Opportunities Tab */}
              {tabValue === 1 && (
                <Box>
                  {upsellingSuggestions.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Product ID</TableCell>
                            <TableCell>Product Name</TableCell>
                            <TableCell>Justification</TableCell>
                            <TableCell align="center">Suggested Qty</TableCell>
                            <TableCell align="right">Unit Price</TableCell>
                            <TableCell align="right">Expected Revenue</TableCell>
                            <TableCell align="center">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {upsellingSuggestions.map((suggestion, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Typography variant="body2" fontFamily="monospace">
                                  {suggestion.productId}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {suggestion.productName}
                                </Typography>
                                {suggestion.category && (
                                  <Typography variant="caption" color="text.secondary">
                                    {suggestion.category} {suggestion.brand && `- ${suggestion.brand}`}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {suggestion.justification}
                                </Typography>
                                <Chip 
                                  label={`${(suggestion.confidence * 100).toFixed(0)}% confidence`}
                                  size="small"
                                  color={suggestion.confidence > 0.7 ? 'success' : 'default'}
                                  sx={{ mt: 0.5 }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                {suggestion.suggestedQuantity}
                              </TableCell>
                              <TableCell align="right">
                                ${suggestion.unitPrice.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" color="success.main" fontWeight="medium">
                                  ${suggestion.expectedRevenue.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<AddIcon />}
                                  onClick={() => {
                                    const product = products.find(p => p.id === suggestion.productId);
                                    if (product) {
                                      setFormData(prev => ({
                                        ...prev,
                                        items: [...prev.items, {
                                          productId: suggestion.productId,
                                          quantity: suggestion.suggestedQuantity,
                                          unitPrice: suggestion.unitPrice,
                                          discount: 0,
                                          notes: `Upsell: ${suggestion.justification}`,
                                          product
                                        }]
                                      }));
                                      // Remove from suggestions after adding
                                      setUpsellingSuggestions(prev => 
                                        prev.filter(s => s.productId !== suggestion.productId)
                                      );
                                    }
                                  }}
                                  disabled={formData.items.some(i => i.productId === suggestion.productId)}
                                >
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box py={3} textAlign="center">
                      <Typography color="text.secondary">
                        No upselling opportunities available. Add items to the order to see complementary product suggestions.
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Products Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Order Items</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddProduct}
                disabled={!formData.storeId}
              >
                Add Product
              </Button>
            </Box>

            {formData.items.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2">{item.product?.name || item.productId}</Typography>
                          {item.product?.sku && (
                            <Typography variant="caption" color="text.secondary">
                              SKU: {item.product.sku}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell align="right">
                          ${(item.quantity * item.unitPrice * (1 - item.discount / 100)).toFixed(2)}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => handleEditItem(index)} size="small">
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => handleRemoveItem(index)} size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box py={4} textAlign="center">
                <Typography color="text.secondary">
                  No products added yet. Click "Add Product" to get started.
                </Typography>
              </Box>
            )}

            {/* Order Summary */}
            {formData.items.length > 0 && (
              <Box mt={2} display="flex" justifyContent="flex-end">
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2">Items:</Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Typography>{itemCount}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h6">Total:</Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Typography variant="h6">
                        ${subtotal.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={loading || formData.items.length === 0}
            >
              {id ? 'Update Order' : 'Create Order'}
            </Button>
          </Box>
        </Grid>
      </Grid>
      
      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onClose={handleCloseProductDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItemIndex !== null ? 'Edit Product' : 'Add Product'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {selectedProduct && (
              <>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {selectedProduct.name}
                    </Typography>
                    {selectedProduct.sku && (
                      <Typography variant="body2" color="text.secondary">
                        SKU: {selectedProduct.sku}
                      </Typography>
                    )}
                    {selectedProduct.category && (
                      <Typography variant="body2" color="text.secondary">
                        Category: {selectedProduct.category}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseProductDialog}>Cancel</Button>
          <Button onClick={handleAddOrUpdateProduct} color="primary">
            {editingItemIndex !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => handleConfirmDialogClose(false)}>
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConfirmDialogClose(false)}>No</Button>
          <Button onClick={() => handleConfirmDialogClose(true)} color="primary">Yes</Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrderCreatePage;
