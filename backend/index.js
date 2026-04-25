require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db');
const authRoutes = require('./auth/routes');
const applicantRoutes = require('./applicant/routes');
const recruiterRoutes = require('./recruiter/routes');
const applicationsRoutes = require('./applications/routes');
const jobsRoutes = require('./jobs/routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/applicant', applicantRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/jobs', jobsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
