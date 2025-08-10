import React from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon } from '@mui/icons-material';

/**
 * NotFoundPage component
 * 
 * This component is displayed when a user navigates to a route that doesn't exist.
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 5,
            borderRadius: 2,
            maxWidth: 600,
            width: '100%',
          }}
        >
          <Typography variant="h1" component="h1" sx={{ fontSize: '6rem', fontWeight: 'bold', color: 'primary.main' }}>
            404
          </Typography>
          <Typography variant="h4" component="h2" gutterBottom>
            Page Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ px: 4, py: 1.5 }}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
