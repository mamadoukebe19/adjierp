const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const stockRoutes = require('./routes/stock');
const clientRoutes = require('./routes/clients');
const orderRoutes = require('./routes/orders');
const quoteRoutes = require('./routes/quotes');
const invoiceRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration trust proxy pour Docker
app.set('trust proxy', 1);

// Middleware de sécurité
app.use(helmet());
app.use(compression());

// Limitation du taux de requêtes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limite à 1000 requêtes par fenêtre par IP
  message: 'Trop de requêtes depuis cette IP, réessayez plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1'
});
app.use('/api/', limiter);

// Configuration CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://localhost:3000', 'http://localhost:80'] 
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Middleware de logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Middleware pour parser JSON et URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Test de connexion à la base de données
db.getConnection((err, connection) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connexion à MySQL réussie');
    connection.release();
  }
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'DOCC ERP API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: err.details
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
  
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Cette donnée existe déjà'
    });
  }
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : err.message
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Démarrage du serveur
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur DOCC ERP démarré sur le port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
