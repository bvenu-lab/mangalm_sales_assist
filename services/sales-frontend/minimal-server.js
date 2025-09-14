// Ultra-minimal server for Cloud Run - starts immediately
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Log startup
console.log(`Starting server on port ${PORT}...`);

// Health check FIRST - Cloud Run needs this immediately
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'sales-frontend', port: PORT });
});

// Check if build folder exists
const fs = require('fs');
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  console.log('Build folder found, serving static files...');

  // Serve static files
  app.use(express.static(buildPath));

  // Handle React routing
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Build not found - please run npm run build');
    }
  });
} else {
  console.log('Build folder not found - serving placeholder...');

  // Fallback if no build
  app.get('*', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Sales Frontend</title></head>
        <body>
          <h1>Sales Frontend - Build Required</h1>
          <p>The React build folder was not found. Please run 'npm run build' before deployment.</p>
          <p>Server is running on port ${PORT}</p>
        </body>
      </html>
    `);
  });
}

// Start immediately - no async operations
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check available at http://0.0.0.0:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});