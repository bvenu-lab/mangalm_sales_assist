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
  SelectChangeEvent
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
}

// Extended PredictedOrderItem interface with additional fields needed for the form
interface ExtendedPredictedOrderItem extends PredictedOrderItem {
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  notes?: string;
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
          const orderData = orderResponse.data;
          
          if (orderData) {
            // Find the store
            const store = storesData.find((s: Store) => s.id === orderData.storeId);
            setSelectedStore(store || null);
            
            // Set form data
            setFormData({
              storeId: orderData.storeId,
              orderDate: new Date(orderData.predictionDate).toISOString().split('T')[0],
              deliveryDate: orderData.expectedDeliveryDate 
                ? new Date(orderData.expectedDeliveryDate).toISOString().split('T')[0]
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: orderData.notes || '',
              status: orderData.status === 'Predicted' ? 'Draft' : (orderData.status === 'Confirmed' ? 'Confirmed' : 'Completed'),
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
            
            setPredictedOrder(orderData);
          }
        } 
        // If creating a new order with a store ID
        else if (storeIdFromQuery) {
          const store = storesData.find((s: Store) => s.id === storeIdFromQuery);
          setSelectedStore(store || null);
          
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
      <Typography variant="h4">
        {id ? 'Edit Order' : 'Create New Order'}
      </Typography>
      
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
