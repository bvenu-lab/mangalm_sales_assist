import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../../services/auth-service';

const SimplifiedLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await authService.login('demo', 'demo2025');
    
    if (result.success) {
      // Success - navigate to dashboard
      navigate('/dashboard');
    } else {
      // Failed - show error
      setError(result.error || 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#333',
          fontSize: '28px'
        }}>
          Simplified Login
        </h1>
        
        <form onSubmit={handleLogin}>
          <div style={{
            background: '#f5f5f5',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <strong>Demo Credentials:</strong><br/>
            Username: demo<br/>
            Password: demo2025
          </div>

          {error && (
            <div style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              fontWeight: '600',
              background: isLoading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s'
            }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ 
          marginTop: '30px', 
          fontSize: '12px', 
          color: '#666',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          <p>✅ Simplified authentication architecture</p>
          <p>✅ Single auth service, no complex contexts</p>
          <p>✅ Standard React form submission</p>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedLoginPage;