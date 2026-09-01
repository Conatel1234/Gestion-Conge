require('dotenv').config();
const path = require('path');
const express = require('express');
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

app.use(express.json({ limit: '8mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }, // 8h
}));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gestion des Conges - serveur demarre sur http://localhost:${PORT}`);
});
