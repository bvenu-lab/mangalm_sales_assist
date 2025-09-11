import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';

const SimpleLoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    console.log('=== SIMPLE LOGIN: Button clicked ===');
    console.log('Username:', username);
    console.log('Password:', password ? '***' : 'empty');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Making login API call...');
      const response = await fetch('http://localhost:3007/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (data.success && data.token) {
        console.log('Login successful! Storing token...');
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('Redirecting to dashboard...');
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5'
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h4" align="center" gutterBottom>
          Simple Login
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => {
            console.log('Username typed:', e.target.value);
            setUsername(e.target.value);
          }}
          margin="normal"
          placeholder="demo"
        />

        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => {
            console.log('Password typed');
            setPassword(e.target.value);
          }}
          margin="normal"
          placeholder="demo2025"
        />

        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            console.log('Button onClick fired!');
            handleLogin();
          }}
          disabled={loading}
          sx={{ mt: 3, py: 1.5 }}
        >
          {loading ? 'Logging in...' : 'LOGIN'}
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Use: demo / demo2025
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default SimpleLoginPage;