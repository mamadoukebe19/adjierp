const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { generateToken, generateRefreshToken, verifyRefreshToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateLogin = [
  body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
];

const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 50 caractères')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),
  body('email').isEmail().withMessage('Format d\'email invalide'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('firstName').notEmpty().withMessage('Le prénom est requis'),
  body('lastName').notEmpty().withMessage('Le nom de famille est requis')
];

// Route de connexion
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Vérification des erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Recherche de l'utilisateur
    const users = await executeQuery(
      'SELECT id, username, email, password_hash, first_name, last_name, role, is_active FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const user = users[0];

    // Vérification du mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Génération des tokens
    const accessToken = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Mise à jour de la dernière connexion
    await executeQuery(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// Route d'inscription (accessible seulement aux admins)
router.post('/register', validateRegister, authenticateToken, async (req, res) => {
  try {
    // Vérification des permissions (seuls les admins peuvent créer des comptes)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent créer des comptes'
      });
    }

    // Vérification des erreurs de validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, role = 'user' } = req.body;

    // Vérification que l'utilisateur n'existe pas déjà
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà'
      });
    }

    // Hachage du mot de passe
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Création de l'utilisateur
    const result = await executeQuery(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, firstName, lastName, role]
    );

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        userId: result.insertId,
        username,
        email,
        firstName,
        lastName,
        role
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// Route de rafraîchissement du token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token manquant'
      });
    }

    // Vérification du refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Vérification que l'utilisateur existe toujours
    const users = await executeQuery(
      'SELECT id, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    const user = users[0];

    // Génération d'un nouveau access token
    const accessToken = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Token rafraîchi avec succès',
      data: {
        accessToken
      }
    });

  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    res.status(401).json({
      success: false,
      message: 'Refresh token invalide'
    });
  }
});

// Route de déconnexion
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Note: Dans une implémentation complète, on pourrait ajouter une liste noire des tokens
    // Pour cette version, on se contente de confirmer la déconnexion côté client

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// Route pour obtenir les informations du profil utilisateur
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await executeQuery(
      'SELECT id, username, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        firstName: user[0].first_name,
        lastName: user[0].last_name,
        role: user[0].role,
        createdAt: user[0].created_at,
        updatedAt: user[0].updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// Route de changement de mot de passe
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Le mot de passe actuel est requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Récupération du mot de passe actuel
    const users = await executeQuery(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérification du mot de passe actuel
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Hachage du nouveau mot de passe
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mise à jour du mot de passe
    await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
