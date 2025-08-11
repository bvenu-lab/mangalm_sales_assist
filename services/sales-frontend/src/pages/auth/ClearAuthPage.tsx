import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Divider
} from '@mui/material';
import {
  Clear as ClearIcon,
  Login as LoginIcon
} from '@mui/icons-material';

const ClearAuthPage: React.FC = () => {
  const [tokenStatus, setTokenStatus] = useState<string>('Checking...');
  const [cleared, setCleared] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setTokenStatus(`Present (length: ${token.length})`);
    } else {
      setTokenStatus('Not found');
    }
  };

  const clearAuth = () => {
    // Clear all authentication-related data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    setCleared(true);
    checkStatus();
    
    // Redirect to login after 2 seconds
    setTimeout(() => {
      navigate('/login');
    }, 2000);
  };

  const goToLogin = () => {
    // Set flag to prevent auto-redirect
    sessionStorage.setItem('stay_on_login', 'true');
    navigate('/login');
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
          maxWidth: 500,
          width: '100%',
          borderRadius: 2
        }}
      >
        <Typography variant="h4" gutterBottom align="center">
          Authentication Management
        </Typography>
        
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Use this page to clear stored authentication tokens
        </Typography>

        {cleared && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Authentication cleared successfully! Redirecting to login...
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<ClearIcon />}
            onClick={clearAuth}
            disabled={cleared}
          >
            Clear Authentication
          </Button>
          
          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={goToLogin}
          >
            Go to Login
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6" gutterBottom>
            Current Storage Status:
          </Typography>
          <Typography variant="body1">
            Auth Token: <strong style={{ 
              color: tokenStatus.includes('Present') ? '#ff9800' : '#4caf50' 
            }}>{tokenStatus}</strong>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ClearAuthPage;