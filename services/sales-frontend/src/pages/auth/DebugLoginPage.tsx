import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const DebugLoginPage: React.FC = () => {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo2025');
  const [clickCount, setClickCount] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { login } = useAuth();

  useEffect(() => {
    console.log('[DEBUG] Component mounted');
    
    // Add a direct DOM listener to verify events work
    const button = buttonRef.current;
    if (button) {
      const handleClick = () => {
        console.log('[DEBUG] Native DOM click event fired!');
      };
      button.addEventListener('click', handleClick);
      return () => button.removeEventListener('click', handleClick);
    }
  }, []);

  // Test if state updates work
  const testStateUpdate = () => {
    console.log('[DEBUG] testStateUpdate called');
    setClickCount(prev => {
      console.log('[DEBUG] State updating from', prev, 'to', prev + 1);
      return prev + 1;
    });
  };

  // Direct login function
  const handleDirectLogin = async () => {
    console.log('[DEBUG] ===== DIRECT LOGIN ATTEMPT =====');
    console.log('[DEBUG] Username:', username);
    console.log('[DEBUG] Password (full):', password);
    console.log('[DEBUG] Password length:', password.length);
    console.log('[DEBUG] Credentials object:', { username, password });
    
    // First try direct API call to bypass any issues
    console.log('[DEBUG] Making direct API call first...');
    try {
      const response = await fetch('http://localhost:3007/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      console.log('[DEBUG] Direct API Response:', data);
      console.log('[DEBUG] Status:', response.status);
      
      if (data.success && data.token) {
        console.log('[DEBUG] Direct API login successful! Storing token and redirecting...');
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Force redirect
        console.log('[DEBUG] Redirecting to dashboard in 1 second...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
        return;
      } else {
        console.error('[DEBUG] Direct API login failed:', data);
      }
    } catch (apiError) {
      console.error('[DEBUG] Direct API error:', apiError);
    }
    
    // Only try auth context if direct fails
    console.log('[DEBUG] Trying auth context login as fallback...');
    try {
      await login(username, password);
    } catch (error) {
      console.error('[DEBUG] Auth context login error:', error);
    }
  };

  return (
    <div style={{ padding: '50px', fontFamily: 'monospace' }}>
      <h1>Debug Login Page</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h3>Test 1: React State Updates</h3>
        <p>Click count: {clickCount}</p>
        <button 
          onClick={() => {
            console.log('[DEBUG] Button 1 onClick fired');
            testStateUpdate();
          }}
          style={{ padding: '10px', margin: '5px' }}
        >
          Test State Update (Count: {clickCount})
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#e0e0e0' }}>
        <h3>Test 2: Inline Handler</h3>
        <button 
          onClick={() => console.log('[DEBUG] Inline onClick works!')}
          style={{ padding: '10px', margin: '5px' }}
        >
          Test Inline onClick
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#d0d0d0' }}>
        <h3>Test 3: Input Fields</h3>
        <div>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              console.log('[DEBUG] Username onChange:', e.target.value);
              setUsername(e.target.value);
            }}
            placeholder="Username"
            style={{ padding: '5px', margin: '5px' }}
          />
          <span>Current: {username}</span>
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              console.log('[DEBUG] Password onChange');
              setPassword(e.target.value);
            }}
            placeholder="Password"
            style={{ padding: '5px', margin: '5px' }}
          />
          <span>Length: {password.length}</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#c0c0c0' }}>
        <h3>Test 4: Different Event Types</h3>
        <button 
          onMouseEnter={() => console.log('[DEBUG] Mouse entered button')}
          onMouseLeave={() => console.log('[DEBUG] Mouse left button')}
          onMouseDown={() => console.log('[DEBUG] Mouse down on button')}
          onMouseUp={() => console.log('[DEBUG] Mouse up on button')}
          onClick={() => console.log('[DEBUG] Button clicked')}
          style={{ padding: '10px', margin: '5px' }}
        >
          Hover and Click Me
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#b0b0b0' }}>
        <h3>Test 5: Native DOM Event</h3>
        <button 
          ref={buttonRef}
          style={{ padding: '10px', margin: '5px' }}
        >
          Native Event Button (check console)
        </button>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#90EE90', border: '2px solid green' }}>
        <h2>Actual Login</h2>
        <button 
          onClick={() => {
            console.log('[DEBUG] Login button clicked!');
            handleDirectLogin();
          }}
          style={{ 
            padding: '15px 30px', 
            fontSize: '18px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          LOGIN with form values
        </button>
        
        <button 
          onClick={async () => {
            console.log('[DEBUG] Hardcoded login clicked!');
            // Use hardcoded values to bypass any state issues
            const hardcodedCreds = { username: 'demo', password: 'demo2025' };
            console.log('[DEBUG] Using hardcoded:', hardcodedCreds);
            
            try {
              const response = await fetch('http://localhost:3007/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hardcodedCreds)
              });
              
              const data = await response.json();
              console.log('[DEBUG] Hardcoded login response:', data);
              
              if (data.success && data.token) {
                console.log('[DEBUG] SUCCESS! Redirecting...');
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard';
              }
            } catch (err) {
              console.error('[DEBUG] Hardcoded login error:', err);
            }
          }}
          style={{ 
            padding: '15px 30px', 
            fontSize: '18px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          LOGIN HARDCODED (demo/demo2025)
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Console Output Expected:</h3>
        <ul>
          <li>When clicking buttons: Should see onClick messages</li>
          <li>When typing: Should see onChange messages</li>
          <li>When hovering: Should see mouse events</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugLoginPage;