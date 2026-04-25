require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db');
const authRoutes = require('./auth/routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
