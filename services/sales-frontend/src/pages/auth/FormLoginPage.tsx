import React from 'react';

const FormLoginPage: React.FC = () => {
  console.log('[FormLoginPage] Component rendered');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[FormLoginPage] Form submitted!');
    
    fetch('http://localhost:3007/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'demo2025' })
    })
    .then(res => res.json())
    .then(data => {
      console.log('[FormLoginPage] Response:', data);
      if (data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      }
    })
    .catch(err => console.error('[FormLoginPage] Error:', err));
  };

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
        width: '400px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Form Login</h1>
        
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="username" value="demo" />
          <input type="hidden" name="password" value="demo2025" />
          
          <button
            type="submit"
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
            SUBMIT FORM TO LOGIN
          </button>
        </form>
        
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666', textAlign: 'center' }}>
          <p>Uses form submit instead of onClick</p>
          <p>Credentials: demo / demo2025</p>
        </div>
      </div>
    </div>
  );
};

export default FormLoginPage;