import { Router, Request, Response } from 'express';

const router = Router();

// Hardcoded credentials for local testing ONLY
const TEST_CREDENTIALS = {
  username: 'admin@mangalm.com',
  password: 'admin123'
};

// Hardcoded test user
const TEST_USER = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'admin@mangalm.com',
  email: 'admin@mangalm.com',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'User',
  name: 'Admin User',
  permissions: ['all']
};

// Simple login endpoint for local testing
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (username === TEST_CREDENTIALS.username && password === TEST_CREDENTIALS.password) {
    // Generate a simple token (NOT SECURE - for local testing only)
    const token = btoa(`${username}:${Date.now()}`);
    
    res.json({
      success: true,
      token: token,
      user: TEST_USER
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Simple verify endpoint for local testing
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For local testing, any token is valid
    res.json({
      success: true,
      user: TEST_USER
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;