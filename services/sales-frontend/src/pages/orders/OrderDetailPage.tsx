import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Inventory as InventoryIcon,
  Scanner as ScannerIcon,
} from '@mui/icons-material';
import apiGatewayClient from '../../services/api-gateway-client';
import { format } from 'date-fns';

interface OrderItem {
  id?: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
  inStock?: boolean;
  availableQuantity?: number;
  extractionConfidence?: number;
}

interface OrderDetail {
  id: string;
  order_number: string;
  store_id: string;
  store?: {
    id: string;
    name: string;
    city?: string;
  };
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  item_count: number;
  total_quantity: number;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  source: string;
  extraction_confidence?: number;
  data_quality_score?: number;
  manual_verification_required?: boolean;
  notes?: string;
  created_at: string;
  order_date?: string;
}

// Helper function to safely parse numbers from database values
const safeParseFloat = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
};

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedOrder, setEditedOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);

  useEffect(() => {
    fetchOrderDetails();
    // Check stock availability for items
    checkStockAvailability();
  }, [id]);

  const fetchOrderDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      // Fetch order details from API
      const response = await apiGatewayClient.get(`/api/orders/${id}`);
      
      if (response.data) {
        const orderData = response.data.data || response.data;
        setOrder(orderData);
        setEditedOrder(JSON.parse(JSON.stringify(orderData))); // Deep copy for editing
      }
    } catch (err: any) {
      console.error('Failed to fetch order details:', err);
      setError('Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkStockAvailability = async () => {
    // In a real implementation, this would check actual inventory
    // For now, we'll simulate with random availability
    const warnings: string[] = [];
    
    if (order?.items) {
      order.items.forEach(item => {
        const availableQty = Math.floor(Math.random() * 200) + 50;
        const itemQty = safeParseFloat(item.quantity);
        if (itemQty > availableQty) {
          warnings.push(`${item.productName}: Only ${availableQty} units available (ordered: ${itemQty})`);
        }
      });
    }
    
    setStockWarnings(warnings);
  };

  const handleEditToggle = () => {
    if (editMode) {
      // Cancel editing - restore original
      setEditedOrder(JSON.parse(JSON.stringify(order)));
      setEditMode(false);
    } else {
      setEditMode(true);
    }
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    if (!editedOrder) return;
    
    const updatedItems = [...editedOrder.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    
    // Recalculate total price for the item
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].totalPrice = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    // Recalculate order totals
    const subtotal = updatedItems.reduce((sum, item) => sum + safeParseFloat(item.totalPrice), 0);
    const taxAmount = subtotal * 0.18; // 18% GST
    const totalAmount = subtotal + taxAmount;
    const totalQuantity = updatedItems.reduce((sum, item) => sum + safeParseFloat(item.quantity), 0);
    
    setEditedOrder({
      ...editedOrder,
      items: updatedItems,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      total_quantity: totalQuantity,
      item_count: updatedItems.length,
    });
  };

  const handleAddItem = () => {
    if (!editedOrder) return;
    
    const newItem: OrderItem = {
      productName: 'New Product',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      unit: 'pieces',
    };
    
    if (!editedOrder) return;
    
    setEditedOrder({
      ...editedOrder,
      items: [...editedOrder.items, newItem],
      item_count: editedOrder.items.length + 1,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editedOrder || editedOrder.items.length <= 1) return;
    
    const updatedItems = editedOrder.items.filter((_, i) => i !== index);
    
    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + safeParseFloat(item.totalPrice), 0);
    const taxAmount = subtotal * 0.18;
    const totalAmount = subtotal + taxAmount;
    const totalQuantity = updatedItems.reduce((sum, item) => sum + safeParseFloat(item.quantity), 0);
    
    setEditedOrder({
      ...editedOrder,
      items: updatedItems,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      total_quantity: totalQuantity,
      item_count: updatedItems.length,
    });
  };

  const handleSave = async () => {
    if (!editedOrder) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Update order via API
      const response = await apiGatewayClient.put(`/api/orders/${id}`, {
        customer_name: editedOrder?.customer_name || '',
        customer_phone: editedOrder?.customer_phone || '',
        customer_email: editedOrder?.customer_email || '',
        items: editedOrder?.items || [],
        notes: editedOrder?.notes || '',
        manual_verification_required: false, // Mark as verified after manual edit
        status: 'confirmed', // Change status to confirmed after review
      });
      
      if (response.data) {
        setOrder(editedOrder);
        setEditMode(false);
        // Show success message
        console.log('Order updated successfully');
      }
    } catch (err: any) {
      console.error('Failed to save order:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiGatewayClient.delete(`/api/orders/${id}`);
      navigate('/orders');
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      setError('Failed to delete order. Please try again.');
    }
    setDeleteConfirmOpen(false);
  };

  const handleApprove = async () => {
    try {
      setSaving(true);
      await apiGatewayClient.post(`/api/orders/${id}/confirm`, {
        notes: 'Order reviewed and confirmed',
        userId: 'current-user', // Get from auth context
        userName: 'Current User',
      });
      
      setOrder(prev => prev ? { ...prev, status: 'confirmed' } : null);
    } catch (err: any) {
      console.error('Failed to approve order:', err);
      setError('Failed to approve order. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Box p={3}>
        <Alert severity="error">Order not found</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  const displayOrder = editMode ? editedOrder : order;
  if (!displayOrder) return null;

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Order {displayOrder.order_number}
            </Typography>
            <Box display="flex" gap={1} mt={1}>
              <Chip
                label={displayOrder.status}
                color={
                  displayOrder.status === 'confirmed' ? 'success' :
                  displayOrder.status === 'pending_review' ? 'warning' :
                  'default'
                }
                size="small"
              />
              {displayOrder.source === 'document' && (
                <Chip
                  icon={<ScannerIcon />}
                  label="Scanned Document"
                  color="info"
                  size="small"
                />
              )}
              {displayOrder.extraction_confidence && (
                <Chip
                  label={`${(safeParseFloat(displayOrder.extraction_confidence) * 100).toFixed(0)}% Confidence`}
                  color={displayOrder.extraction_confidence > 0.8 ? 'success' : 'warning'}
                  size="small"
                />
              )}
            </Box>
          </Box>
        </Box>
        
        <Box display="flex" gap={2}>
          {!editMode && displayOrder.status === 'pending_review' && (
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={saving}
              startIcon={<CheckCircleIcon />}
            >
              Approve Order
            </Button>
          )}
          <Button
            variant={editMode ? "outlined" : "contained"}
            color={editMode ? "inherit" : "primary"}
            onClick={handleEditToggle}
            startIcon={editMode ? <CancelIcon /> : <EditIcon />}
          >
            {editMode ? 'Cancel' : 'Edit'}
          </Button>
          {editMode && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={saving}
              startIcon={<SaveIcon />}
            >
              Save Changes
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteConfirmOpen(true)}
            startIcon={<DeleteIcon />}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stock Warnings */}
      {stockWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Stock Availability Issues:
          </Typography>
          {stockWarnings.map((warning, index) => (
            <Typography key={index} variant="body2">
              • {warning}
            </Typography>
          ))}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Order Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Store
                  </Typography>
                  <Typography variant="body1">
                    {displayOrder.store?.name || 'Unknown Store'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Order Date
                  </Typography>
                  <Typography variant="body1">
                    {displayOrder.order_date || displayOrder.created_at
                      ? format(new Date(displayOrder.order_date || displayOrder.created_at), 'MMM dd, yyyy')
                      : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Total Items
                  </Typography>
                  <Typography variant="body1">
                    {displayOrder.item_count} ({displayOrder.total_quantity} units)
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    ₹{safeParseFloat(displayOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Customer Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {editMode ? (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Customer Name"
                      value={editedOrder?.customer_name || ''}
                      onChange={(e) => setEditedOrder(prev => prev ? { ...prev, customer_name: e.target.value } : null)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={editedOrder?.customer_phone || ''}
                      onChange={(e) => setEditedOrder(prev => prev ? { ...prev, customer_phone: e.target.value } : null)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={editedOrder?.customer_email || ''}
                      onChange={(e) => setEditedOrder(prev => prev ? { ...prev, customer_email: e.target.value } : null)}
                    />
                  </Grid>
                </Grid>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Name
                    </Typography>
                    <Typography variant="body1">
                      {displayOrder.customer_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Phone
                    </Typography>
                    <Typography variant="body1">
                      {displayOrder.customer_phone || 'Not provided'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">
                      {displayOrder.customer_email || 'Not provided'}
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Order Items */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Order Items
                </Typography>
                {editMode && (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddItem}
                    size="small"
                  >
                    Add Item
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product Name</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Unit Price</TableCell>
                      <TableCell>Total Price</TableCell>
                      {displayOrder.source === 'document' && (
                        <TableCell>Confidence</TableCell>
                      )}
                      <TableCell>Stock Status</TableCell>
                      {editMode && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayOrder.items.map((item, index) => {
                      const availableQty = Math.floor(Math.random() * 200) + 50;
                      const inStock = safeParseFloat(item.quantity) <= availableQty;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {editMode ? (
                              <TextField
                                value={item.productName}
                                onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                                fullWidth
                                size="small"
                              />
                            ) : (
                              <Typography variant="body2">
                                {item.productName}
                                {item.productCode && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    Code: {item.productCode}
                                  </Typography>
                                )}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {editMode ? (
                              <TextField
                                type="number"
                                value={safeParseFloat(item.quantity)}
                                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                size="small"
                                sx={{ width: 100 }}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">{item.unit || 'pcs'}</InputAdornment>
                                }}
                              />
                            ) : (
                              `${safeParseFloat(item.quantity)} ${item.unit || 'pcs'}`
                            )}
                          </TableCell>
                          <TableCell>
                            {editMode ? (
                              <TextField
                                type="number"
                                value={safeParseFloat(item.unitPrice)}
                                onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                size="small"
                                sx={{ width: 100 }}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                                }}
                              />
                            ) : (
                              `₹${safeParseFloat(item.unitPrice).toFixed(2)}`
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              ₹{safeParseFloat(item.totalPrice).toFixed(2)}
                            </Typography>
                          </TableCell>
                          {displayOrder.source === 'document' && (
                            <TableCell>
                              {item.extractionConfidence && (
                                <Chip
                                  label={`${(safeParseFloat(item.extractionConfidence) * 100).toFixed(0)}%`}
                                  size="small"
                                  color={item.extractionConfidence > 0.8 ? 'success' : 'warning'}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Chip
                              icon={<InventoryIcon />}
                              label={inStock ? `In Stock (${availableQty})` : `Low Stock (${availableQty})`}
                              color={inStock ? 'success' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          {editMode && (
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveItem(index)}
                                disabled={displayOrder.items.length <= 1}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Order Totals */}
              <Box mt={3} display="flex" justifyContent="flex-end">
                <Box width={300}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Subtotal:</Typography>
                    <Typography>₹{safeParseFloat(displayOrder.subtotal_amount).toFixed(2)}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography>Tax (18%):</Typography>
                    <Typography>₹{safeParseFloat(displayOrder.tax_amount).toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="h6">Total:</Typography>
                    <Typography variant="h6" color="primary">
                      ₹{safeParseFloat(displayOrder.total_amount).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {editMode ? (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Order Notes"
                  value={editedOrder?.notes || ''}
                  onChange={(e) => setEditedOrder(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="Add any special instructions or notes about this order..."
                />
              ) : (
                <Typography variant="body1" color={displayOrder.notes ? 'text.primary' : 'text.secondary'}>
                  {displayOrder.notes || 'No notes added'}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete order {order.order_number}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderDetailPage;