const express = require('express');
require('express-async-errors');
const path = require('path');
// const cors = require('cors');
const session = require('express-session');

const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const leaveTypeRoutes = require('./routes/leaveTypes');
const fiscalExerciceRoutes = require('./routes/fiscalExercices');
const holidayRoutes = require('./routes/holidays');
const leaveRecordRoutes = require('./routes/leaveRecords');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/exports');
const backupRoutes = require('./routes/backups');

const app = express();

// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true, 
    maxAge: 8 * 60 * 60 * 1000, // 8h
    secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL, // Required for HTTPS on Vercel
    sameSite: 'lax'
  },
}));
// Mount API routes

// Auth ne requiert pas de session
app.use('/api/auth', authRoutes);

// Toutes les routes API suivantes sont reservees a la RH connectee
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/leave-types', requireAuth, leaveTypeRoutes);
app.use('/api/fiscal-exercices', requireAuth, fiscalExerciceRoutes);
app.use('/api/holidays', requireAuth, holidayRoutes);
app.use('/api/leave-records', requireAuth, leaveRecordRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/exports', requireAuth, exportRoutes);
app.use('/api/backups', requireAuth, backupRoutes);

app.use('/images', express.static(path.join(__dirname, '..', 'images')));
app.use(express.static(path.join(__dirname, '..', 'public')));


// Static file fallback for Linux/Local execution
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack || err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});
module.exports = app;