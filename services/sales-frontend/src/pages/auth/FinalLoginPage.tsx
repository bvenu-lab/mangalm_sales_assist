import React from 'react';

const FinalLoginPage: React.FC = () => {
  React.useEffect(() => {
    console.log('[FinalLoginPage] Mounted');
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        width: '400px',
        textAlign: 'center'
      }}>
        <h1>Simple Login</h1>
        
        <button
          onClick={() => {
            console.log('Button clicked!');
            alert('Button clicked! Check console.');
            
            // Direct login without async/await
            fetch('http://localhost:3007/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: 'demo', password: 'demo2025' })
            })
            .then(res => res.json())
            .then(data => {
              console.log('Response:', data);
              if (data.success && data.token) {
                alert('Login successful! Token: ' + data.token.substring(0, 30) + '...');
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setTimeout(() => {
                  window.location.href = '/dashboard';
                }, 1000);
              } else {
                alert('Login failed: ' + (data.error || 'Unknown error'));
              }
            })
            .catch(err => {
              console.error('Error:', err);
              alert('Network error: ' + err.message);
            });
          }}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          CLICK ME TO LOGIN
        </button>
        
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          <p>Credentials: demo / demo2025</p>
          <p>This button will show alerts at each step</p>
        </div>
      </div>
    </div>
  );
};

export default FinalLoginPage;