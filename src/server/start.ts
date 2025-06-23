import app from './index';

const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, () => {
  console.log(`Font Inspector server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/inspect`);
}); 