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
  Alert,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
  Store as StoreIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { CallPrioritization, Store } from '../../types/models';

const CallListPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Calls state
  const [calls, setCalls] = useState<CallPrioritization[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallPrioritization[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Contact dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallPrioritization | null>(null);
  const [contactNotes, setContactNotes] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  
  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  
  // Fetch calls data
  useEffect(() => {
    const fetchCalls = async () => {
      try {
        setLoading(true);
        const response = await api.callPrioritization.getAll();
        const callsData = response.data?.data || [];
        setCalls(callsData);
        setFilteredCalls(callsData);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch call data. Please try again later.');
        setLoading(false);
        console.error('Error fetching calls:', err);
      }
    };

    fetchCalls();
  }, []);
  
  // Filter calls
  useEffect(() => {
    let filtered = [...calls];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => call.status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        call => 
          (call.store?.name?.toLowerCase() || '').includes(lowercasedSearch) ||
          (call.priorityReason?.toLowerCase() || '').includes(lowercasedSearch) ||
          (call.assignedAgent?.toLowerCase() || '').includes(lowercasedSearch)
      );
    }
    
    // Sort by priority score (highest first)
    filtered.sort((a, b) => b.priorityScore - a.priorityScore);
    
    setFilteredCalls(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, calls]);
  
  // Handle pagination
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle status filter change
  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
  };
  
  // Navigate to store detail
  const handleStoreClick = (storeId: string) => {
    navigate(`/stores/${storeId}`);
  };
  
  // Open contact dialog
  const handleOpenContactDialog = (call: CallPrioritization) => {
    setSelectedCall(call);
    setContactNotes('');
    setContactError(null);
    setContactDialogOpen(true);
  };
  
  // Close contact dialog
  const handleCloseContactDialog = () => {
    setContactDialogOpen(false);
    setSelectedCall(null);
  };
  
  // Handle contact notes change
  const handleContactNotesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setContactNotes(event.target.value);
  };
  
  // Mark call as contacted
  const handleMarkAsContacted = async () => {
    if (!selectedCall) return;
    
    try {
      setContactLoading(true);
      await api.callPrioritization.markAsContacted(selectedCall.id, contactNotes);
      
      // Update call in state
      setCalls(prevCalls => prevCalls.map(call => {
        if (call.id === selectedCall.id) {
          return {
            ...call,
            status: 'Completed',
            lastCallDate: new Date().toISOString()
          };
        }
        return call;
      }));
      
      setContactLoading(false);
      setContactDialogOpen(false);
      setSelectedCall(null);
    } catch (err) {
      console.error('Error marking call as contacted:', err);
      setContactError('Failed to update call status. Please try again.');
      setContactLoading(false);
    }
  };
  
  // Open reschedule dialog
  const handleOpenRescheduleDialog = (call: CallPrioritization) => {
    setSelectedCall(call);
    // Set default reschedule date to 7 days from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setRescheduleDate(nextWeek.toISOString().split('T')[0]);
    setRescheduleError(null);
    setRescheduleDialogOpen(true);
  };
  
  // Close reschedule dialog
  const handleCloseRescheduleDialog = () => {
    setRescheduleDialogOpen(false);
    setSelectedCall(null);
  };
  
  // Handle reschedule date change
  const handleRescheduleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRescheduleDate(event.target.value);
  };
  
  // Reschedule call
  const handleRescheduleCall = async () => {
    if (!selectedCall || !rescheduleDate) return;
    
    try {
      setRescheduleLoading(true);
      await api.callPrioritization.reschedule(selectedCall.id, rescheduleDate);
      
      // Update call in state
      setCalls(prevCalls => prevCalls.map(call => {
        if (call.id === selectedCall.id) {
          return {
            ...call,
            status: 'Pending',
            nextCallDate: rescheduleDate
          };
        }
        return call;
      }));
      
      setRescheduleLoading(false);
      setRescheduleDialogOpen(false);
      setSelectedCall(null);
    } catch (err) {
      console.error('Error rescheduling call:', err);
      setRescheduleError('Failed to reschedule call. Please try again.');
      setRescheduleLoading(false);
    }
  };
  
  // Get priority level label and color
  const getPriorityLevel = (score: number) => {
    if (score >= 8) return { label: 'High', color: 'error' as const };
    if (score >= 5) return { label: 'Medium', color: 'warning' as const };
    return { label: 'Low', color: 'default' as const };
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
          Call Prioritization
        </Typography>
      </Box>
      
      {/* Call Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9f9ff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pending Calls
              </Typography>
              <Typography variant="h3" color="primary" gutterBottom>
                {calls.filter(call => call.status === 'Pending').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calls that need to be made
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#f9fff9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Completed Today
              </Typography>
              <Typography variant="h3" color="success.main" gutterBottom>
                {calls.filter(call => {
                  if (call.status !== 'Completed') return false;
                  const today = new Date().toISOString().split('T')[0];
                  const callDate = new Date(call.lastCallDate || '').toISOString().split('T')[0];
                  return callDate === today;
                }).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calls completed today
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ bgcolor: '#fffcf9' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                High Priority
              </Typography>
              <Typography variant="h3" color="error" gutterBottom>
                {calls.filter(call => call.priorityScore >= 8 && call.status === 'Pending').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                High priority calls that need attention
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
            placeholder="Search by store name, reason, or assigned agent..."
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
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              label="Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Completed">Completed</MenuItem>
              <MenuItem value="Skipped">Skipped</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      {/* Calls Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><Typography variant="subtitle2">Store</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Priority</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Reason</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Last Call</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Next Call</Typography></TableCell>
                <TableCell><Typography variant="subtitle2">Status</Typography></TableCell>
                <TableCell align="right"><Typography variant="subtitle2">Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCalls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body1" py={3}>
                      No calls found. Try a different search term or filter.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalls
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((call) => {
                    const priority = getPriorityLevel(call.priorityScore);
                    return (
                      <TableRow 
                        key={call.id} 
                        hover 
                        onClick={() => call.store && handleStoreClick(call.store.id)}
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: call.status === 'Pending' && call.priorityScore >= 8 ? 'rgba(255, 0, 0, 0.05)' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <StoreIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {call.store?.name || 'Unknown Store'}
                              </Typography>
                              {call.store?.city && (
                                <Typography variant="body2" color="text.secondary">
                                  {call.store.city}
                                  {call.store.region ? `, ${call.store.region}` : ''}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${priority.label} (${call.priorityScore})`}
                            color={priority.color}
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {call.priorityReason || 'Regular follow-up'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {call.lastCallDate ? (
                            <Typography variant="body2">
                              {new Date(call.lastCallDate).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No previous calls
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {call.nextCallDate ? (
                            <Typography variant="body2">
                              {new Date(call.nextCallDate).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not scheduled
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={call.status}
                            color={
                              call.status === 'Completed' ? 'success' : 
                              call.status === 'Skipped' ? 'default' : 'primary'
                            }
                            size="small" 
                          />
                        </TableCell>
                        <TableCell align="right">
                          {call.status === 'Pending' && (
                            <>
                              <Tooltip title="Mark as contacted">
                                <IconButton 
                                  color="success" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenContactDialog(call);
                                  }}
                                >
                                  <CheckCircleIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reschedule">
                                <IconButton 
                                  color="primary" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRescheduleDialog(call);
                                  }}
                                >
                                  <ScheduleIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="View store details">
                            <IconButton 
                              color="primary" 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (call.store) handleStoreClick(call.store.id);
                              }}
                            >
                              <ArrowForwardIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredCalls.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={handleCloseContactDialog}>
        <DialogTitle>Mark Call as Contacted</DialogTitle>
        <DialogContent>
          {contactError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {contactError}
            </Alert>
          )}
          <Box mb={2} mt={1}>
            <Typography variant="body1">
              Store: <strong>{selectedCall?.store?.name}</strong>
            </Typography>
          </Box>
          <TextField
            label="Contact Notes"
            multiline
            rows={4}
            fullWidth
            value={contactNotes}
            onChange={handleContactNotesChange}
            placeholder="Enter details about the call..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseContactDialog} disabled={contactLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleMarkAsContacted} 
            color="primary" 
            disabled={contactLoading}
            startIcon={contactLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Mark as Contacted
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onClose={handleCloseRescheduleDialog}>
        <DialogTitle>Reschedule Call</DialogTitle>
        <DialogContent>
          {rescheduleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rescheduleError}
            </Alert>
          )}
          <Box mb={2} mt={1}>
            <Typography variant="body1">
              Store: <strong>{selectedCall?.store?.name}</strong>
            </Typography>
          </Box>
          <TextField
            label="Next Call Date"
            type="date"
            fullWidth
            value={rescheduleDate}
            onChange={handleRescheduleDateChange}
            variant="outlined"
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRescheduleDialog} disabled={rescheduleLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleRescheduleCall} 
            color="primary" 
            disabled={rescheduleLoading || !rescheduleDate}
            startIcon={rescheduleLoading ? <CircularProgress size={20} /> : <ScheduleIcon />}
          >
            Reschedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CallListPage;
