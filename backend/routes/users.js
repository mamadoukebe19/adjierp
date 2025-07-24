const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizeOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation pour création/mise à jour d'utilisateur
const validateUser = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 50 caractères')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),
  body('email').optional().isEmail().withMessage('Format d\'email invalide'),
  body('firstName').optional().notEmpty().withMessage('Le prénom ne peut être vide'),
  body('lastName').optional().notEmpty().withMessage('Le nom de famille ne peut être vide'),
  body('role').optional().isIn(['admin', 'production', 'manager', 'user']).withMessage('Rôle invalide')
];

// GET /api/users - Récupérer tous les utilisateurs (admin/manager seulement)
router.get('/', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const role = req.query.role;
    const isActive = req.query.isActive;
    const search = req.query.search;

    let whereConditions = [];
    let params = [];

    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    if (isActive !== undefined) {
      whereConditions.push('is_active = ?');
      params.push(isActive === 'true');
    }

    if (search) {
      whereConditions.push('(username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Requête pour le total
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;

    // Requête principale
    const query = `
      SELECT 
        id,
        username,
        email,
        first_name,
        last_name,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, users] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(query, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult[0].total / limit),
          totalItems: countResult[0].total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/users/:id - Récupérer un utilisateur spécifique
router.get('/:id', [authenticateToken, authorizeOwnerOrAdmin], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const users = await executeQuery(
      'SELECT id, username, email, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/users/:id - Mettre à jour un utilisateur
router.put('/:id', [authenticateToken, authorizeOwnerOrAdmin, ...validateUser], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const userId = parseInt(req.params.id);
    const { username, email, firstName, lastName, role } = req.body;

    // Vérification que l'utilisateur existe
    const existingUsers = await executeQuery(
      'SELECT id, role FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Seuls les admins peuvent modifier le rôle
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent modifier les rôles'
      });
    }

    // Vérification d'unicité pour username et email si fournis
    if (username || email) {
      let checkQuery = 'SELECT id FROM users WHERE (';
      let checkParams = [];
      let conditions = [];

      if (username) {
        conditions.push('username = ?');
        checkParams.push(username);
      }

      if (email) {
        conditions.push('email = ?');
        checkParams.push(email);
      }

      checkQuery += conditions.join(' OR ') + ') AND id != ?';
      checkParams.push(userId);

      const duplicateUsers = await executeQuery(checkQuery, checkParams);

      if (duplicateUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà'
        });
      }
    }

    // Construction de la requête de mise à jour dynamique
    let updateFields = [];
    let updateParams = [];

    if (username !== undefined) {
      updateFields.push('username = ?');
      updateParams.push(username);
    }

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateParams.push(firstName);
    }

    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateParams.push(lastName);
    }

    if (role !== undefined && req.user.role === 'admin') {
      updateFields.push('role = ?');
      updateParams.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(userId);

    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

    await executeQuery(updateQuery, updateParams);

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/users/:id/toggle-status - Activer/désactiver un utilisateur (admin seulement)
router.put('/:id/toggle-status', [authenticateToken, authorizeRoles('admin')], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Vérification que l'utilisateur existe
    const users = await executeQuery(
      'SELECT id, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la désactivation de son propre compte
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas désactiver votre propre compte'
      });
    }

    const newStatus = !users[0].is_active;

    await executeQuery(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, userId]
    );

    res.json({
      success: true,
      message: `Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`,
      data: {
        userId,
        isActive: newStatus
      }
    });

  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur (admin seulement)
router.delete('/:id', [authenticateToken, authorizeRoles('admin')], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Vérification que l'utilisateur existe
    const users = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la suppression de son propre compte
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Vérification des dépendances (rapports, commandes, etc.)
    const dependencies = await Promise.all([
      executeQuery('SELECT COUNT(*) as count FROM daily_reports WHERE user_id = ?', [userId]),
      executeQuery('SELECT COUNT(*) as count FROM orders WHERE created_by = ?', [userId]),
      executeQuery('SELECT COUNT(*) as count FROM pba_stock_movements WHERE created_by = ?', [userId])
    ]);

    const [reports, orders, movements] = dependencies;
    const hasReports = reports[0].count > 0;
    const hasOrders = orders[0].count > 0;
    const hasMovements = movements[0].count > 0;

    if (hasReports || hasOrders || hasMovements) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cet utilisateur car il a des données associées',
        dependencies: {
          reports: reports[0].count,
          orders: orders[0].count,
          movements: movements[0].count
        }
      });
    }

    // Suppression de l'utilisateur
    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/users/:id/reset-password - Réinitialiser le mot de passe (admin seulement)
router.put('/:id/reset-password', [
  authenticateToken,
  authorizeRoles('admin'),
  body('newPassword').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
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

    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    // Vérification que l'utilisateur existe
    const users = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Hachage du nouveau mot de passe
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mise à jour du mot de passe
    await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/users/stats/overview - Statistiques des utilisateurs (admin/manager)
router.get('/stats/overview', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    // Statistiques générales
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count,
        COUNT(CASE WHEN role = 'production' THEN 1 END) as production_count,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d
      FROM users
    `);

    // Utilisateurs les plus actifs (par nombre de rapports)
    const activeUsers = await executeQuery(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.role,
        COUNT(dr.id) as report_count
      FROM users u
      LEFT JOIN daily_reports dr ON u.id = dr.user_id AND dr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE u.is_active = TRUE
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.role
      ORDER BY report_count DESC
      LIMIT 10
    `);

    // Répartition par rôle
    const roleDistribution = await executeQuery(`
      SELECT 
        role,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        activeUsers,
        roleDistribution
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/users/:id/activity - Activité d'un utilisateur
router.get('/:id/activity', [authenticateToken, authorizeOwnerOrAdmin], async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const days = parseInt(req.query.days) || 30;

    // Vérification que l'utilisateur existe
    const users = await executeQuery(
      'SELECT id, username, first_name, last_name FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Rapports créés
    const reports = await executeQuery(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_reports,
        MAX(created_at) as last_report_date
      FROM daily_reports
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [userId, days]);

    // Mouvements de stock créés
    const stockMovements = await executeQuery(`
      SELECT 
        COUNT(*) as total_movements,
        MAX(created_at) as last_movement_date
      FROM pba_stock_movements
      WHERE created_by = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [userId, days]);

    // Activité par jour
    const dailyActivity = await executeQuery(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as report_count
      FROM daily_reports
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId, days]);

    res.json({
      success: true,
      data: {
        user: users[0],
        reports: reports[0],
        stockMovements: stockMovements[0],
        dailyActivity
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
