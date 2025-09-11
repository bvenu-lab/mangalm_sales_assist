import React from 'react';

const TestButtonPage: React.FC = () => {
  // Test different ways of handling clicks
  
  const handleClick1 = () => {
    console.log('=== BUTTON 1 CLICKED ===');
    alert('Button 1 clicked!');
  };

  return (
    <div style={{ padding: '50px' }}>
      <h1>Button Click Test</h1>
      
      <div style={{ margin: '20px 0' }}>
        <h3>Test 1: Function reference</h3>
        <button onClick={handleClick1} style={{ padding: '10px 20px' }}>
          Click Me (Function Ref)
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Test 2: Inline arrow function</h3>
        <button 
          onClick={() => {
            console.log('=== BUTTON 2 CLICKED ===');
            alert('Button 2 clicked!');
          }}
          style={{ padding: '10px 20px' }}
        >
          Click Me (Inline Arrow)
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Test 3: Direct console.log</h3>
        <button 
          onClick={() => console.log('=== BUTTON 3 CLICKED ===')}
          style={{ padding: '10px 20px' }}
        >
          Click Me (Console Only)
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Test 4: Native HTML button</h3>
        <button 
          type="button"
          style={{ padding: '10px 20px' }}
          dangerouslySetInnerHTML={{
            __html: 'Click Me (HTML)'
          }}
          onClick={() => console.log('=== BUTTON 4 CLICKED ===')}
        />
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Test 5: Div as button</h3>
        <div 
          onClick={() => {
            console.log('=== DIV CLICKED ===');
            alert('Div clicked!');
          }}
          style={{ 
            padding: '10px 20px',
            background: '#2196F3',
            color: 'white',
            display: 'inline-block',
            cursor: 'pointer'
          }}
        >
          Click Me (Div)
        </div>
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#f0f0f0' }}>
        <h3>Expected behavior:</h3>
        <ul>
          <li>Each button should log to console when clicked</li>
          <li>Some buttons should show an alert</li>
          <li>If NONE work, React events are completely broken</li>
          <li>If SOME work, we can identify the pattern</li>
        </ul>
      </div>
    </div>
  );
};

export default TestButtonPage;