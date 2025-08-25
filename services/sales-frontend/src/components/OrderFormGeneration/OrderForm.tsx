/**
 * Order Form Component - Phase 6
 * Enterprise-Grade Order Form for Mangalm Sales Assistant
 * 
 * This component provides a comprehensive order form interface for viewing,
 * editing, and managing orders generated from processed documents.
 * Features enterprise-grade validation, real-time calculations, and 
 * intuitive user experience with confidence indicators.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Fab,
  Snackbar
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  ShoppingCart as CartIcon,
  Payment as PaymentIcon,
  LocalShipping as ShippingIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  AutoFixHigh as SuggestionIcon,
  Timeline as ConfidenceIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { formatCurrency, formatDate, formatPhoneNumber } from '../../utils/formatting';

// Types
interface OrderItem {
  id?: string;
  productId?: string;
  productName: string;
  productCode?: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tax?: number;
  discount?: number;
  extractionConfidence?: number;
  manuallyVerified?: boolean;
  notes?: string;
}

interface OrderFormData {
  id?: string;
  orderNumber: string;
  storeId: string;
  storeName?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  items: OrderItem[];
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  shippingMethod: string;
  paymentMethod?: string;
  paymentTerms?: string;
  notes?: string;
  specialInstructions?: string;
  extractionConfidence: number;
  dataQualityScore: number;
  manualVerificationRequired: boolean;
  manuallyVerified: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  confidence?: number;
}

interface Suggestion {
  type: 'correction' | 'enhancement' | 'warning';
  field: string;
  message: string;
  suggestedValue?: any;
}

interface QualityAssessment {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: Array<{
    name: string;
    score: number;
    issues: string[];
  }>;
}

interface OrderFormProps {
  order: OrderFormData;
  validationErrors?: ValidationError[];
  suggestions?: Suggestion[];
  qualityAssessment?: QualityAssessment;
  isEditing?: boolean;
  isLoading?: boolean;
  onSave?: (order: OrderFormData) => Promise<void>;
  onCancel?: () => void;
  onEdit?: () => void;
  onConfirm?: () => Promise<void>;
  onReject?: () => Promise<void>;
  onApplySuggestion?: (suggestion: Suggestion) => void;
  showAdvancedOptions?: boolean;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  order: initialOrder,
  validationErrors = [],
  suggestions = [],
  qualityAssessment,
  isEditing = false,
  isLoading = false,
  onSave,
  onCancel,
  onEdit,
  onConfirm,
  onReject,
  onApplySuggestion,
  showAdvancedOptions = false
}) => {
  const theme = useTheme();
  const [order, setOrder] = useState<OrderFormData>(initialOrder);
  const [editMode, setEditMode] = useState(isEditing);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showQualityDetails, setShowQualityDetails] = useState(false);
  const [showConfidenceIndicators, setShowConfidenceIndicators] = useState(true);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: (() => void) | null;
  }>({ open: false, title: '', message: '', action: null });

  // Calculate totals when items change
  const calculatedTotals = useMemo(() => {
    const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax - order.discountAmount + order.shippingAmount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }, [order.items, order.discountAmount, order.shippingAmount]);

  // Update totals when calculated values change
  useEffect(() => {
    if (editMode) {
      setOrder(prev => ({
        ...prev,
        subtotalAmount: calculatedTotals.subtotal,
        taxAmount: calculatedTotals.tax,
        totalAmount: calculatedTotals.total
      }));
    }
  }, [calculatedTotals, editMode]);

  // Get confidence color based on score
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return theme.palette.success.main;
    if (confidence >= 0.7) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // Get quality grade color
  const getQualityGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return theme.palette.success.main;
      case 'B': return theme.palette.info.main;
      case 'C': return theme.palette.warning.main;
      case 'D': return theme.palette.warning.dark;
      case 'F': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  // Handle field changes
  const handleFieldChange = (field: string, value: any) => {
    setOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle item changes
  const handleItemChange = (index: number, field: string, value: any) => {
    setOrder(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { 
          ...item, 
          [field]: value,
          ...(field === 'quantity' || field === 'unitPrice' ? {
            totalPrice: (field === 'quantity' ? value : item.quantity) * 
                       (field === 'unitPrice' ? value : item.unitPrice)
          } : {})
        } : item
      )
    }));
  };

  // Add new item
  const handleAddItem = () => {
    const newItem: OrderItem = {
      productName: '',
      unit: 'piece',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      extractionConfidence: 0,
      manuallyVerified: true
    };
    
    setOrder(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (onSave) {
      try {
        await onSave(order);
        setEditMode(false);
        setSnackbarMessage('Order saved successfully');
      } catch (error) {
        setSnackbarMessage('Failed to save order');
      }
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setOrder(initialOrder);
    setEditMode(false);
    if (onCancel) onCancel();
  };

  // Handle edit
  const handleEdit = () => {
    setEditMode(true);
    if (onEdit) onEdit();
  };

  // Handle confirm
  const handleConfirm = () => {
    setConfirmDialog({
      open: true,
      title: 'Confirm Order',
      message: 'Are you sure you want to confirm this order? This action cannot be undone.',
      action: async () => {
        if (onConfirm) {
          try {
            await onConfirm();
            setSnackbarMessage('Order confirmed successfully');
          } catch (error) {
            setSnackbarMessage('Failed to confirm order');
          }
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  // Handle reject
  const handleReject = () => {
    setConfirmDialog({
      open: true,
      title: 'Reject Order',
      message: 'Are you sure you want to reject this order? This action cannot be undone.',
      action: async () => {
        if (onReject) {
          try {
            await onReject();
            setSnackbarMessage('Order rejected');
          } catch (error) {
            setSnackbarMessage('Failed to reject order');
          }
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  // Apply suggestion
  const handleApplySuggestion = (suggestion: Suggestion) => {
    if (suggestion.field.includes('[')) {
      // Handle array field (items)
      const matches = suggestion.field.match(/items\[(\d+)\]\.(.+)/);
      if (matches) {
        const itemIndex = parseInt(matches[1]);
        const itemField = matches[2];
        handleItemChange(itemIndex, itemField, suggestion.suggestedValue);
      }
    } else {
      // Handle regular field
      handleFieldChange(suggestion.field, suggestion.suggestedValue);
    }
    
    if (onApplySuggestion) {
      onApplySuggestion(suggestion);
    }
    
    setSnackbarMessage('Suggestion applied');
  };

  // Get validation errors for field
  const getFieldErrors = (field: string) => {
    return validationErrors.filter(error => error.field === field);
  };

  // Get suggestions for field
  const getFieldSuggestions = (field: string) => {
    return suggestions.filter(suggestion => suggestion.field === field);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Order {order.orderNumber}
                {showConfidenceIndicators && (
                  <Tooltip title={`Extraction Confidence: ${(order.extractionConfidence * 100).toFixed(1)}%`}>
                    <Chip 
                      size="small" 
                      icon={<ConfidenceIcon />}
                      label={`${(order.extractionConfidence * 100).toFixed(0)}%`}
                      sx={{ 
                        ml: 2,
                        backgroundColor: getConfidenceColor(order.extractionConfidence),
                        color: 'white'
                      }}
                    />
                  </Tooltip>
                )}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip 
                  label={order.status} 
                  color={order.status === 'confirmed' ? 'success' : 'default'}
                  variant="outlined"
                />
                <Chip 
                  label={order.paymentStatus} 
                  color={order.paymentStatus === 'paid' ? 'success' : 'warning'}
                  variant="outlined"
                />
                {qualityAssessment && (
                  <Chip 
                    label={`Quality: ${qualityAssessment.grade}`}
                    sx={{ 
                      backgroundColor: getQualityGradeColor(qualityAssessment.grade),
                      color: 'white'
                    }}
                  />
                )}
                {order.manualVerificationRequired && (
                  <Chip 
                    icon={<WarningIcon />}
                    label="Review Required"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {showAdvancedOptions && (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showConfidenceIndicators}
                        onChange={(e) => setShowConfidenceIndicators(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Show Confidence"
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showSuggestions}
                        onChange={(e) => setShowSuggestions(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Show Suggestions"
                    sx={{ mr: 2 }}
                  />
                </>
              )}
              
              {!editMode ? (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                  disabled={isLoading}
                >
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={isLoading}
                  >
                    Save
                  </Button>
                </>
              )}
            </Box>
          </Box>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Validation Issues</AlertTitle>
              {validationErrors.map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error.message}
                </Typography>
              ))}
            </Alert>
          )}

          {/* Quality Assessment */}
          {qualityAssessment && (
            <Accordion expanded={showQualityDetails} onChange={() => setShowQualityDetails(!showQualityDetails)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <AssessmentIcon />
                  <Typography variant="h6">
                    Quality Assessment: {qualityAssessment.grade} ({qualityAssessment.overallScore}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={qualityAssessment.overallScore}
                    sx={{ flexGrow: 1, ml: 2 }}
                    color={qualityAssessment.grade <= 'B' ? 'success' : 'warning'}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {qualityAssessment.dimensions.map((dimension, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {dimension.name}: {dimension.score}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={dimension.score}
                            sx={{ mb: 1 }}
                          />
                          {dimension.issues.length > 0 && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Issues:
                              </Typography>
                              {dimension.issues.map((issue, issueIndex) => (
                                <Typography key={issueIndex} variant="body2" color="warning.main">
                                  • {issue}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Customer Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CartIcon />
                Customer Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Customer Name"
                    value={order.customerName}
                    onChange={(e) => handleFieldChange('customerName', e.target.value)}
                    disabled={!editMode}
                    error={getFieldErrors('customerName').length > 0}
                    helperText={getFieldErrors('customerName')[0]?.message}
                    InputProps={{
                      endAdornment: showConfidenceIndicators && order.extractionConfidence && (
                        <Tooltip title={`Confidence: ${(order.extractionConfidence * 100).toFixed(1)}%`}>
                          <Chip 
                            size="small" 
                            label={`${(order.extractionConfidence * 100).toFixed(0)}%`}
                            sx={{ backgroundColor: getConfidenceColor(order.extractionConfidence), color: 'white' }}
                          />
                        </Tooltip>
                      )
                    }}
                  />
                  {showSuggestions && getFieldSuggestions('customerName').map((suggestion, index) => (
                    <Alert 
                      key={index}
                      severity="info" 
                      sx={{ mt: 1 }}
                      action={
                        <Button 
                          size="small" 
                          onClick={() => handleApplySuggestion(suggestion)}
                          startIcon={<SuggestionIcon />}
                        >
                          Apply
                        </Button>
                      }
                    >
                      {suggestion.message}
                    </Alert>
                  ))}
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={order.customerPhone || ''}
                    onChange={(e) => handleFieldChange('customerPhone', e.target.value)}
                    disabled={!editMode}
                    error={getFieldErrors('customerPhone').length > 0}
                    helperText={getFieldErrors('customerPhone')[0]?.message}
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={order.customerEmail || ''}
                    onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                    disabled={!editMode}
                    InputProps={{
                      startAdornment: <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon />
                Order Details
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Order Date"
                    type="date"
                    value={order.orderDate.split('T')[0]}
                    onChange={(e) => handleFieldChange('orderDate', e.target.value)}
                    disabled={!editMode}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Delivery Date"
                    type="date"
                    value={order.requestedDeliveryDate?.split('T')[0] || ''}
                    onChange={(e) => handleFieldChange('requestedDeliveryDate', e.target.value)}
                    disabled={!editMode}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth disabled={!editMode}>
                    <InputLabel>Shipping Method</InputLabel>
                    <Select
                      value={order.shippingMethod}
                      onChange={(e) => handleFieldChange('shippingMethod', e.target.value)}
                      startAdornment={<ShippingIcon sx={{ mr: 1, color: 'action.active' }} />}
                    >
                      <MenuItem value="standard">Standard</MenuItem>
                      <MenuItem value="express">Express</MenuItem>
                      <MenuItem value="overnight">Overnight</MenuItem>
                      <MenuItem value="pickup">Pickup</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Payment Terms"
                    value={order.paymentTerms || ''}
                    onChange={(e) => handleFieldChange('paymentTerms', e.target.value)}
                    disabled={!editMode}
                    InputProps={{
                      startAdornment: <PaymentIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Items */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Order Items</Typography>
                {editMode && (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddItem}
                    size="small"
                  >
                    Add Item
                  </Button>
                )}
              </Box>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      {showConfidenceIndicators && <TableCell align="center">Confidence</TableCell>}
                      {editMode && <TableCell align="center">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <TextField
                            fullWidth
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                            disabled={!editMode}
                            variant={editMode ? 'outlined' : 'standard'}
                            size="small"
                            error={getFieldErrors(`items[${index}].productName`).length > 0}
                          />
                          {item.productCode && (
                            <Typography variant="caption" color="text.secondary">
                              SKU: {item.productCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            disabled={!editMode}
                            variant={editMode ? 'outlined' : 'standard'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={!editMode}
                            variant={editMode ? 'outlined' : 'standard'}
                            size="small"
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            disabled={!editMode}
                            variant={editMode ? 'outlined' : 'standard'}
                            size="small"
                            inputProps={{ min: 0, step: 0.01 }}
                            InputProps={{
                              startAdornment: <Typography variant="body2">₹</Typography>
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(item.totalPrice)}
                          </Typography>
                        </TableCell>
                        {showConfidenceIndicators && (
                          <TableCell align="center">
                            {item.extractionConfidence !== undefined && (
                              <Tooltip title={`Extraction confidence: ${(item.extractionConfidence * 100).toFixed(1)}%`}>
                                <Chip
                                  size="small"
                                  label={`${(item.extractionConfidence * 100).toFixed(0)}%`}
                                  sx={{
                                    backgroundColor: getConfidenceColor(item.extractionConfidence),
                                    color: 'white'
                                  }}
                                />
                              </Tooltip>
                            )}
                            {item.manuallyVerified && (
                              <Tooltip title="Manually verified">
                                <CheckCircleIcon sx={{ color: 'success.main', ml: 1 }} />
                              </Tooltip>
                            )}
                          </TableCell>
                        )}
                        {editMode && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Order Summary</Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'between', py: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>{formatCurrency(calculatedTotals.subtotal)}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'between', py: 1 }}>
                <Typography>Tax (18% GST):</Typography>
                <Typography>{formatCurrency(calculatedTotals.tax)}</Typography>
              </Box>
              
              {order.discountAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'between', py: 1 }}>
                  <Typography>Discount:</Typography>
                  <Typography color="success.main">
                    -{formatCurrency(order.discountAmount)}
                  </Typography>
                </Box>
              )}
              
              {order.shippingAmount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'between', py: 1 }}>
                  <Typography>Shipping:</Typography>
                  <Typography>{formatCurrency(order.shippingAmount)}</Typography>
                </Box>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'between', py: 1 }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(calculatedTotals.total)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Actions</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {order.status === 'draft' && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleConfirm}
                    disabled={isLoading || validationErrors.some(e => e.severity === 'error')}
                    fullWidth
                  >
                    Confirm Order
                  </Button>
                )}
                
                {(order.status === 'draft' || order.status === 'pending_review') && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<ErrorIcon />}
                    onClick={handleReject}
                    disabled={isLoading}
                    fullWidth
                  >
                    Reject Order
                  </Button>
                )}
                
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Quality Score: {order.dataQualityScore}% |
                    Confidence: {(order.extractionConfidence * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notes & Instructions</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Customer Notes"
                    value={order.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    disabled={!editMode}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Special Instructions"
                    value={order.specialInstructions || ''}
                    onChange={(e) => handleFieldChange('specialInstructions', e.target.value)}
                    disabled={!editMode}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Floating Action Button for Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Fab
          color="info"
          aria-label="suggestions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={() => setShowSuggestions(!showSuggestions)}
        >
          <Badge badgeContent={suggestions.length} color="error">
            <SuggestionIcon />
          </Badge>
        </Fab>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
            Cancel
          </Button>
          <Button onClick={confirmDialog.action || (() => {})} variant="contained" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />

      {/* Loading overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography>Processing order...</Typography>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default OrderForm;