import React, { useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const SettingsPage: React.FC = () => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClearAllOrders = async () => {
    if (confirmationText !== 'CLEAR ALL ORDERS') {
      setError('Please type "CLEAR ALL ORDERS" to confirm');
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      // Call API to clear all orders
      const response = await fetch('/api/orders/clear-all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to clear orders: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Clear orders result:', result);

      setClearSuccess(true);
      setConfirmDialogOpen(false);
      setConfirmationText('');
      
      // Show success message for 5 seconds
      setTimeout(() => setClearSuccess(false), 5000);
      
    } catch (err) {
      console.error('Error clearing orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear orders');
    } finally {
      setIsClearing(false);
    }
  };

  const resetConfirmDialog = () => {
    setConfirmDialogOpen(false);
    setConfirmationText('');
    setError(null);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      {clearSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          All order history has been successfully cleared. Dashboard charts will now show empty data until new orders are added.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Data Management Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" component="h2">
                  Data Management
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Manage your order data and reset the system to a clean state.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <List>
                <ListItem>
                  <ListItemIcon>
                    <DeleteIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Clear All Order History"
                    secondary="Permanently delete all orders, customers, and transaction data. This action cannot be undone."
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setConfirmDialogOpen(true)}
                    >
                      Clear All
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AnalyticsIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6" component="h2">
                  System Info
                </Typography>
              </Box>
              
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Application"
                    secondary="Mangalm Sales Assistant"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Version"
                    secondary="1.0.0"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Environment"
                    secondary="Local Development"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={resetConfirmDialog}
        maxWidth="sm"
        fullWidth
        aria-labelledby="clear-confirm-dialog-title"
      >
        <DialogTitle id="clear-confirm-dialog-title">
          <Box display="flex" alignItems="center">
            <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
            Confirm Clear All Orders
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ DESTRUCTIVE ACTION WARNING ⚠️
            </Typography>
            <Typography variant="body2">
              This will permanently delete ALL orders, customer data, and transaction history. 
              This action cannot be undone and will reset your dashboard to empty state.
            </Typography>
          </Alert>

          <DialogContentText>
            <strong>What will be cleared:</strong>
          </DialogContentText>
          <Box component="ul" sx={{ mt: 1, mb: 2, pl: 2 }}>
            <li>All order records and order history</li>
            <li>Customer information and contact details</li>
            <li>Product sales data and analytics</li>
            <li>Dashboard charts and performance metrics</li>
            <li>Document upload history</li>
          </Box>

          <DialogContentText sx={{ mb: 2 }}>
            <strong>To confirm this action, type:</strong> <code>CLEAR ALL ORDERS</code>
          </DialogContentText>

          <TextField
            autoFocus
            fullWidth
            label="Confirmation Text"
            value={confirmationText}
            onChange={(e) => {
              setConfirmationText(e.target.value);
              setError(null);
            }}
            placeholder="Type: CLEAR ALL ORDERS"
            error={!!error}
            helperText={error || 'Type the exact phrase to enable the clear button'}
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetConfirmDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleClearAllOrders}
            color="error"
            variant="contained"
            disabled={confirmationText !== 'CLEAR ALL ORDERS' || isClearing}
            startIcon={isClearing ? <RefreshIcon className="animate-spin" /> : <DeleteIcon />}
          >
            {isClearing ? 'Clearing...' : 'Clear All Orders'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SettingsPage;