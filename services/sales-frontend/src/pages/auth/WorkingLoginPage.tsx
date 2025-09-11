import React, { useEffect } from 'react';

const WorkingLoginPage: React.FC = () => {
  useEffect(() => {
    console.log('[WORKING LOGIN] Component mounted');
    
    // Clear any existing auth on mount
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }, []);

  const doLogin = async () => {
    console.log('[WORKING LOGIN] Button clicked!');
    alert('Login button was clicked! Check console for details.');
    
    const credentials = {
      username: 'demo',
      password: 'demo2025'
    };
    
    console.log('[WORKING LOGIN] Sending:', credentials);
    
    try {
      const response = await fetch('http://localhost:3007/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      console.log('[WORKING LOGIN] Response:', data);
      console.log('[WORKING LOGIN] Status:', response.status);
      
      if (response.status === 200 && data.success && data.token) {
        console.log('[WORKING LOGIN] Success! Token:', data.token.substring(0, 50) + '...');
        
        // Store credentials
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Show success message
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
          messageDiv.style.background = '#4CAF50';
          messageDiv.style.color = 'white';
          messageDiv.style.padding = '10px';
          messageDiv.textContent = 'Login successful! Redirecting...';
        }
        
        // Wait a moment then redirect
        setTimeout(() => {
          console.log('[WORKING LOGIN] Redirecting to dashboard...');
          window.location.href = '/dashboard';
        }, 1000);
        
      } else {
        console.error('[WORKING LOGIN] Login failed:', data);
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
          messageDiv.style.background = '#f44336';
          messageDiv.style.color = 'white';
          messageDiv.style.padding = '10px';
          messageDiv.textContent = `Login failed: ${data.error || 'Unknown error'}`;
        }
      }
    } catch (error) {
      console.error('[WORKING LOGIN] Network error:', error);
      const messageDiv = document.getElementById('message');
      if (messageDiv) {
        messageDiv.style.background = '#ff9800';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '10px';
        messageDiv.textContent = 'Network error - check if API is running';
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '400px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#333', marginBottom: '30px' }}>Simple Working Login</h1>
        
        <div id="message" style={{ marginBottom: '20px', borderRadius: '5px' }}></div>
        
        <div style={{
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          <strong>Credentials:</strong><br/>
          Username: demo<br/>
          Password: demo2025
        </div>
        
        <button
          onClick={doLogin}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#45a049'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#4CAF50'}
        >
          LOGIN NOW
        </button>
        
        <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
          <p>This page uses direct fetch() API calls.</p>
          <p>No complex auth context or routing.</p>
          <p>Check console for detailed logs.</p>
        </div>
      </div>
    </div>
  );
};

export default WorkingLoginPage;