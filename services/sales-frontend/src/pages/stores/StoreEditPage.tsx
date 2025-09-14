import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import api from '../../services/api';
import apiGatewayClient from '../../services/api-gateway-client';
import { Store } from '../../types/models';

const StoreEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    customer_number: ''
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchStore();
    }
  }, [id]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiGatewayClient.get(`/api/stores/${id}`);
      const storeData = response.data;

      setStore(storeData);
      setFormData({
        name: storeData.name || '',
        address: storeData.address || '',
        city: storeData.city || '',
        state: storeData.state || '',
        phone: storeData.phone || '',
        email: storeData.email || '',
        customer_number: storeData.customer_number || ''
      });
    } catch (err: any) {
      console.error('Error fetching store:', err);
      setError(err.message || 'Failed to load store data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Store name is required';
    }

    if (!formData.address.trim()) {
      errors.address = 'Address is required';
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Invalid email format';
    }

    if (formData.phone && !formData.phone.match(/^[\d\s\-\+\(\)]+$/)) {
      errors.phone = 'Invalid phone format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await apiGatewayClient.put(`/api/stores/${id}`, formData);

      if (response.data) {
        setSuccessMessage('Store updated successfully!');
        setTimeout(() => {
          navigate(`/stores/${id}`);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error updating store:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update store');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/stores/${id}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !store) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/stores')}
          sx={{ mt: 2 }}
        >
          Back to Stores
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/dashboard')}
          underline="hover"
          color="inherit"
        >
          Dashboard
        </Link>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/stores')}
          underline="hover"
          color="inherit"
        >
          Stores
        </Link>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate(`/stores/${id}`)}
          underline="hover"
          color="inherit"
        >
          {store?.name || 'Store Details'}
        </Link>
        <Typography color="text.primary" variant="body2">
          Edit
        </Typography>
      </Breadcrumbs>

      {/* Page Title */}
      <Typography variant="h4" gutterBottom>
        Edit Store
      </Typography>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Edit Form */}
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Store Name */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Store Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                required
                disabled={saving}
              />
            </Grid>

            {/* Customer Number */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Customer Number"
                name="customer_number"
                value={formData.customer_number}
                onChange={handleInputChange}
                disabled={saving}
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                error={!!validationErrors.address}
                helperText={validationErrors.address}
                required
                disabled={saving}
                multiline
                rows={2}
              />
            </Grid>

            {/* City */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                disabled={saving}
              />
            </Grid>

            {/* State */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>State</InputLabel>
                <Select
                  name="state"
                  value={formData.state}
                  onChange={handleSelectChange}
                  label="State"
                  disabled={saving}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="CA">California</MenuItem>
                  <MenuItem value="WA">Washington</MenuItem>
                  <MenuItem value="OR">Oregon</MenuItem>
                  <MenuItem value="TX">Texas</MenuItem>
                  <MenuItem value="NY">New York</MenuItem>
                  <MenuItem value="FL">Florida</MenuItem>
                  <MenuItem value="IL">Illinois</MenuItem>
                  <MenuItem value="PA">Pennsylvania</MenuItem>
                  <MenuItem value="OH">Ohio</MenuItem>
                  <MenuItem value="GA">Georgia</MenuItem>
                  <MenuItem value="NC">North Carolina</MenuItem>
                  <MenuItem value="MI">Michigan</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Phone */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                error={!!validationErrors.phone}
                helperText={validationErrors.phone}
                disabled={saving}
                placeholder="(123) 456-7890"
              />
            </Grid>

            {/* Email */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                disabled={saving}
                placeholder="store@example.com"
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default StoreEditPage;