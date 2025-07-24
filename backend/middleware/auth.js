const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'docc_secret_key_change_in_production';

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'accès manquant'
      });
    }

    // Vérification du token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérification que l'utilisateur existe toujours
    const user = await executeQuery(
      'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );

    if (user.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    // Ajout des informations utilisateur à la requête
    req.user = {
      id: user[0].id,
      username: user[0].username,
      email: user[0].email,
      firstName: user[0].first_name,
      lastName: user[0].last_name,
      role: user[0].role,
      isActive: user[0].is_active
    };

    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token'
    });
  }
};

// Middleware d'autorisation par rôle
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Permissions insuffisantes',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Middleware pour vérifier si l'utilisateur peut modifier ses propres données
const authorizeOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }

  const resourceUserId = parseInt(req.params.userId || req.params.id);
  const isOwner = req.user.id === resourceUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé - Vous ne pouvez modifier que vos propres données'
    });
  }

  next();
};

// Générer un token JWT
const generateToken = (userId, role) => {
  const payload = {
    userId,
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'docc-erp',
    audience: 'docc-users'
  });
};

// Générer un refresh token
const generateRefreshToken = (userId) => {
  const payload = {
    userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'docc-erp',
    audience: 'docc-users'
  });
};

// Vérifier un refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Token type invalide');
    }
    return decoded;
  } catch (error) {
    throw new Error('Refresh token invalide');
  }
};

// Middleware optionnel d'authentification (ne bloque pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await executeQuery(
        'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.userId]
      );

      if (user.length > 0) {
        req.user = {
          id: user[0].id,
          username: user[0].username,
          email: user[0].email,
          firstName: user[0].first_name,
          lastName: user[0].last_name,
          role: user[0].role,
          isActive: user[0].is_active
        };
      }
    }

    next();
  } catch (error) {
    // En cas d'erreur, on continue sans utilisateur
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeOwnerOrAdmin,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  optionalAuth,
  JWT_SECRET
};
