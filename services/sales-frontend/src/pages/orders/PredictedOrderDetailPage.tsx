import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  AlertTitle,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  ShoppingCart as ShoppingCartIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import apiGatewayClient from '../../services/api-gateway-client';
import { formatCurrency } from '../../utils/formatting';

interface PredictedOrderDetail {
  id: string;
  store_id: string;
  store: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    contactPerson: string;
  };
  prediction_date: string;
  confidence_score: number;
  estimated_value: number;
  status: string;
  priority: string;
  ai_recommendation: string;
  justification: string;
  reasoning: string;
  data_sources: Array<{
    type: string;
    weight: number;
    months_analyzed?: number;
    pattern_strength?: string;
    avg_days?: number;
    region?: string;
    category?: string;
  }>;
  pattern_indicators: Array<{
    pattern: string;
    strength: number;
    description: string;
  }>;
  notes: string;
  prediction_model: string;
  manual_verification_required: boolean;
  predicted_items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
    confidence: number;
  }>;
  item_count: number;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  modified_by: string;
}

const PredictedOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<PredictedOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPredictedOrder();
  }, [id]);

  const fetchPredictedOrder = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiGatewayClient.get(`/api/orders/predicted/${id}`);

      if (response.data?.success) {
        setOrder(response.data.data);
      } else {
        throw new Error('Failed to fetch predicted order');
      }
    } catch (err: any) {
      console.error('Error fetching predicted order:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load predicted order');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrder = async () => {
    if (!order) return;

    setActionLoading(true);
    try {
      await apiGatewayClient.put(`/api/orders/predicted/${order.id}/status`, {
        status: 'approved'
      });

      // Refresh the order
      await fetchPredictedOrder();

      // Show success message (could use a toast/snackbar)
      console.log('Order approved successfully');
    } catch (err) {
      console.error('Failed to approve order:', err);
      setError('Failed to approve order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!order) return;

    setActionLoading(true);
    try {
      await apiGatewayClient.put(`/api/orders/predicted/${order.id}/status`, {
        status: 'rejected'
      });

      // Refresh the order
      await fetchPredictedOrder();

      console.log('Order rejected');
    } catch (err) {
      console.error('Failed to reject order:', err);
      setError('Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateActualOrder = () => {
    if (!order) return;
    navigate(`/orders/create/${order.id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'completed': return 'info';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Box p={3}>
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error || 'Predicted order not found'}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">
            Predicted Order Details
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          {order.status === 'pending' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CloseIcon />}
                onClick={handleRejectOrder}
                disabled={actionLoading}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={handleApproveOrder}
                disabled={actionLoading}
              >
                Approve
              </Button>
            </>
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCartIcon />}
            onClick={handleCreateActualOrder}
          >
            Create Order
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Order Overview */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Order Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Order ID
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {order.id.slice(-8).toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Prediction Date
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {new Date(order.prediction_date).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={order.status}
                  color={getStatusColor(order.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Priority
                </Typography>
                <Chip
                  label={order.priority || 'medium'}
                  color={getPriorityColor(order.priority || 'medium')}
                  size="small"
                />
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Confidence Score
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress
                    variant="determinate"
                    value={order.confidence_score * 100}
                    sx={{ flexGrow: 1, height: 8 }}
                    color={getConfidenceColor(order.confidence_score)}
                  />
                  <Typography variant="body1" fontWeight="bold">
                    {(order.confidence_score * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Estimated Value
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatCurrency(order.estimated_value)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Prediction Model
                </Typography>
                <Typography variant="body1">
                  {order.prediction_model || 'Default Model'}
                </Typography>
              </Grid>
            </Grid>

            {order.manual_verification_required && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>Manual Verification Required</AlertTitle>
                This prediction requires manual review before processing.
              </Alert>
            )}
          </Paper>

          {/* AI Analysis */}
          <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              AI Prediction Analysis
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Justification */}
            {order.justification && (
              <Box mb={3}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Justification
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {order.justification}
                </Typography>
              </Box>
            )}

            {/* Reasoning */}
            {order.reasoning && (
              <Box mb={3}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Reasoning Process
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    {order.reasoning}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Data Sources */}
            {order.data_sources && order.data_sources.length > 0 && (
              <Box mb={3}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Data Sources
                </Typography>
                <Grid container spacing={1}>
                  {order.data_sources.map((source, idx) => (
                    <Grid item key={idx}>
                      <Tooltip title={JSON.stringify(source, null, 2)}>
                        <Chip
                          label={`${source.type}: ${(source.weight * 100).toFixed(0)}%`}
                          variant="outlined"
                          color={source.weight > 0.3 ? "primary" : "default"}
                          icon={<InfoIcon />}
                        />
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Pattern Indicators */}
            {order.pattern_indicators && order.pattern_indicators.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Pattern Indicators
                </Typography>
                {order.pattern_indicators.map((pattern, idx) => (
                  <Box key={idx} mb={1}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" fontWeight="medium">
                        {pattern.pattern.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(pattern.strength * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pattern.strength * 100}
                      sx={{ height: 6, mb: 0.5 }}
                      color={pattern.strength > 0.7 ? "success" : "warning"}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {pattern.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Predicted Items */}
          <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Predicted Items ({order.item_count})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Quantity: {order.total_quantity}
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Confidence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.predicted_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {item.productId.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {item.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(item.price)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(item.total)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {item.confidence && (
                          <Chip
                            label={`${(item.confidence * 100).toFixed(0)}%`}
                            size="small"
                            color={getConfidenceColor(item.confidence)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right">
                      <Typography variant="subtitle1" fontWeight="bold">
                        Total Estimated Value
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" color="primary">
                        {formatCurrency(order.estimated_value)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Store Information */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Store Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box display="flex" flexDirection="column" gap={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Store Name
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {order.store.name}
                  </Typography>
                </Box>

                {order.store.address && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <Typography variant="body1">
                      {order.store.address}
                      {order.store.city && `, ${order.store.city}`}
                    </Typography>
                  </Box>
                )}

                {order.store.phone && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Phone
                    </Typography>
                    <Typography variant="body1">
                      {order.store.phone}
                    </Typography>
                  </Box>
                )}

                {order.store.email && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">
                      {order.store.email}
                    </Typography>
                  </Box>
                )}

                {order.store.contactPerson && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Contact Person
                    </Typography>
                    <Typography variant="body1">
                      {order.store.contactPerson}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 3 }}
                onClick={() => navigate(`/stores/${order.store_id}`)}
              >
                View Store Details
              </Button>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card elevation={2} sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Metadata
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box display="flex" flexDirection="column" gap={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created At
                  </Typography>
                  <Typography variant="body2">
                    {new Date(order.created_at).toLocaleString()}
                  </Typography>
                </Box>

                {order.created_by && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created By
                    </Typography>
                    <Typography variant="body2">
                      {order.created_by}
                    </Typography>
                  </Box>
                )}

                {order.updated_at && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {new Date(order.updated_at).toLocaleString()}
                    </Typography>
                  </Box>
                )}

                {order.modified_by && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Modified By
                    </Typography>
                    <Typography variant="body2">
                      {order.modified_by}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          {(order.notes || order.ai_recommendation) && (
            <Card elevation={2} sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Additional Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {order.ai_recommendation && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      AI Recommendation
                    </Typography>
                    <Typography variant="body2">
                      {order.ai_recommendation}
                    </Typography>
                  </Box>
                )}

                {order.notes && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body2">
                      {order.notes}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default PredictedOrderDetailPage;