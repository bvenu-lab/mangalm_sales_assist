import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Link
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  LockOutlined as LockIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface LocationState {
  from?: {
    pathname: string;
  };
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const { login, isAuthenticated, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('[LoginPage] Component rendered', {
    isAuthenticated,
    isSubmitting,
    hasError: !!error,
    username: username ? 'set' : 'empty',
    password: password ? 'set' : 'empty'
  });
  
  // Get the redirect path from location state or default to dashboard
  const locationState = location.state as LocationState;
  const from = locationState?.from?.pathname || '/dashboard';
  
  // Redirect if already authenticated
  useEffect(() => {
    // Check if user explicitly wants to stay on login page (e.g., after logout)
    const stayOnLogin = sessionStorage.getItem('stay_on_login');
    if (isAuthenticated && !stayOnLogin) {
      navigate(from, { replace: true });
    }
    // Clear the flag after checking
    sessionStorage.removeItem('stay_on_login');
  }, [isAuthenticated, navigate, from]);
  
  // Set error from auth context
  useEffect(() => {
    if (error) {
      setLoginError(error);
    }
  }, [error]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[LoginPage] Form submitted!');
    console.log('[LoginPage] Username:', username);
    console.log('[LoginPage] Password:', password ? '***' : '(empty)');
    
    if (!username || !password) {
      console.log('[LoginPage] Validation failed - missing credentials');
      setLoginError('Username and password are required');
      return;
    }
    
    try {
      console.log('[LoginPage] Starting login process...');
      setIsSubmitting(true);
      setLoginError(null);
      
      console.log('[LoginPage] Calling login function from AuthContext...');
      await login(username, password);
      console.log('[LoginPage] Login function completed');
      // Navigation will happen in the useEffect when isAuthenticated changes
    } catch (err) {
      console.error('[LoginPage] Login error:', err);
      // Error is already set in the auth context
      setIsSubmitting(false);
    }
  };
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 450,
          width: '100%',
          borderRadius: 2
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 3
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              width: 56,
              height: 56,
              borderRadius: '50%',
              mb: 2
            }}
          >
            <LockIcon />
          </Box>
          <Typography component="h1" variant="h5" fontWeight="bold">
            Sales Assistant Login
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Enter your credentials to access the sales management platform
          </Typography>
        </Box>
        
        {loginError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {loginError}
          </Alert>
        )}
        
        <Box component="div">
          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => {
              console.log('[LoginPage] Username changed:', e.target.value);
              setUsername(e.target.value);
            }}
            disabled={isSubmitting}
            autoFocus
            required
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                console.log('[LoginPage] Enter pressed in username field');
                e.preventDefault();
              }
            }}
          />
          
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              console.log('[LoginPage] Password changed');
              setPassword(e.target.value);
            }}
            disabled={isSubmitting}
            required
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                console.log('[LoginPage] Enter pressed in password field');
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <Box sx={{ mt: 1, mb: 3, textAlign: 'right' }}>
            <Link 
              component="button"
              variant="body2" 
              underline="hover"
              onClick={(e) => {
                e.preventDefault();
                console.log('[LoginPage] Forgot password clicked');
              }}
            >
              Forgot password?
            </Link>
          </Box>
          
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={isSubmitting}
            onClick={(e) => {
              console.log('[LoginPage] === BUTTON CLICKED ===');
              console.log('[LoginPage] Current username:', username);
              console.log('[LoginPage] Current password:', password ? '***' : '(empty)');
              e.preventDefault();
              e.stopPropagation();
              handleSubmit(e as any);
            }}
            sx={{ py: 1.5 }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Sign In'
            )}
          </Button>
        </Box>
        
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Divider sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Need help?
            </Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            Contact your system administrator or{' '}
            <Link href="mailto:support@mangalm.com" underline="hover">
              technical support
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
