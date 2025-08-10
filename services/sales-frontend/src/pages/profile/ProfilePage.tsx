import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Avatar,
  Divider,
  Card,
  CardContent,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
  phoneNumber: string;
  profileImage?: string;
  createdAt: string;
  lastLogin: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  
  // Fetch user profile
  useEffect(() => {
    // Simulate API call to fetch user profile
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // In a real app, this would be an API call
        // For now, we'll use mock data based on the authenticated user
        setTimeout(() => {
          if (user) {
            const mockProfile: UserProfile = {
              id: user.id || '1',
              username: user.username || 'salesagent1',
              email: user.email || 'agent@mangalm.com',
              fullName: user.name || 'John Doe',
              role: user.role || 'Sales Agent',
              department: 'Sales',
              phoneNumber: '(555) 123-4567',
              profileImage: undefined, // User doesn't have profileImage property
              createdAt: '2025-01-15T08:00:00Z',
              lastLogin: new Date().toISOString()
            };
            
            setProfile(mockProfile);
            setFormData({
              fullName: mockProfile.fullName,
              email: mockProfile.email,
              phoneNumber: mockProfile.phoneNumber,
              currentPassword: '',
              newPassword: '',
              confirmPassword: ''
            });
            setLoading(false);
          } else {
            setError('User not authenticated');
            setLoading(false);
          }
        }, 800);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile data. Please try again later.');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Toggle password visibility
  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };
  
  // Start editing profile
  const handleStartEditing = () => {
    setIsEditing(true);
  };
  
  // Cancel editing
  const handleCancelEditing = () => {
    if (profile) {
      setFormData({
        fullName: profile.fullName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
    setFormErrors({});
    setIsEditing(false);
  };
  
  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    
    // Only validate password fields if any of them have values
    if (formData.currentPassword || formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        errors.currentPassword = 'Current password is required to change password';
      }
      
      if (formData.newPassword && formData.newPassword.length < 8) {
        errors.newPassword = 'Password must be at least 8 characters';
      }
      
      if (formData.newPassword !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Save profile changes
  const handleSaveProfile = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Simulate API call to update profile
      setTimeout(() => {
        // Update local profile state
        if (profile) {
          const updatedProfile = {
            ...profile,
            fullName: formData.fullName,
            email: formData.email,
            phoneNumber: formData.phoneNumber
          };
          
          setProfile(updatedProfile);
          setIsEditing(false);
          setLoading(false);
          
          // Show success notification
          setNotification({
            open: true,
            message: 'Profile updated successfully',
            severity: 'success'
          });
          
          // Clear password fields
          setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
        }
      }, 1000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setLoading(false);
      
      // Show error notification
      setNotification({
        open: true,
        message: 'Failed to update profile. Please try again.',
        severity: 'error'
      });
    }
  };
  
  // Close notification
  const handleCloseNotification = () => {
    setNotification(prev => ({
      ...prev,
      open: false
    }));
  };
  
  // Render loading state
  if (loading && !profile) {
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
      <Typography variant="h4" component="h1" gutterBottom>
        My Profile
      </Typography>
      
      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
              <Avatar
                src={profile?.profileImage}
                alt={profile?.fullName}
                sx={{ width: 120, height: 120, mb: 2 }}
              >
                {profile?.fullName?.charAt(0) || <PersonIcon />}
              </Avatar>
              <Typography variant="h5" gutterBottom>
                {profile?.fullName}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {profile?.role}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profile?.department}
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Username
              </Typography>
              <Typography variant="body1">
                {profile?.username}
              </Typography>
            </Box>
            
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Email
              </Typography>
              <Typography variant="body1">
                {profile?.email}
              </Typography>
            </Box>
            
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Phone
              </Typography>
              <Typography variant="body1">
                {profile?.phoneNumber}
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Account Created
              </Typography>
              <Typography variant="body1">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
              </Typography>
            </Box>
            
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Last Login
              </Typography>
              <Typography variant="body1">
                {profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'N/A'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        {/* Edit Profile Form */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                {isEditing ? 'Edit Profile' : 'Profile Information'}
              </Typography>
              {!isEditing && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleStartEditing}
                >
                  Edit Profile
                </Button>
              )}
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Full Name"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  disabled={!isEditing}
                  error={!!formErrors.fullName}
                  helperText={formErrors.fullName}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  disabled={!isEditing}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Phone Number"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  disabled={!isEditing}
                />
              </Grid>
              
              {isEditing && (
                <>
                  <Grid item xs={12}>
                    <Divider>
                      <Typography variant="body2" color="text.secondary">
                        Change Password (Optional)
                      </Typography>
                    </Divider>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Current Password"
                      name="currentPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.currentPassword}
                      onChange={handleInputChange}
                      fullWidth
                      variant="outlined"
                      error={!!formErrors.currentPassword}
                      helperText={formErrors.currentPassword}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={handleTogglePasswordVisibility}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="New Password"
                      name="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      fullWidth
                      variant="outlined"
                      error={!!formErrors.newPassword}
                      helperText={formErrors.newPassword}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Confirm New Password"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      fullWidth
                      variant="outlined"
                      error={!!formErrors.confirmPassword}
                      helperText={formErrors.confirmPassword}
                    />
                  </Grid>
                </>
              )}
              
              {isEditing && (
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end" mt={2}>
                    <Button
                      variant="outlined"
                      onClick={handleCancelEditing}
                      sx={{ mr: 2 }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSaveProfile}
                      disabled={loading}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
          
          {/* Activity Summary */}
          <Card variant="outlined" sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This section will display your recent activity and performance metrics in a future update.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProfilePage;
