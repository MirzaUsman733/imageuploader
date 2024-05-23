const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3001;

// Set up multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));  // Serve static files from the public directory

// POST route for file uploads
app.post('/upload', upload.fields([{ name: 'pdf' }, { name: 'excel' }]), (req, res) => {
  // Process uploaded files here
  console.log('Received files:', req.files);
  res.json({ message: 'Files received and processed.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
