const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Validation pour création/mise à jour de client
const validateClient = [
  body('companyName').notEmpty().withMessage('Le nom de l\'entreprise est requis'),
  body('contactPerson').optional().isString().withMessage('Le nom du contact doit être du texte'),
  body('email').optional().isEmail().withMessage('Format d\'email invalide'),
  body('phone').optional().isMobilePhone('any').withMessage('Format de téléphone invalide'),
  body('address').optional().isString().withMessage('L\'adresse doit être du texte'),
  body('city').optional().isString().withMessage('La ville doit être du texte'),
  body('postalCode').optional().isString().withMessage('Le code postal doit être du texte'),
  body('country').optional().isString().withMessage('Le pays doit être du texte')
];

// GET /api/clients - Récupérer tous les clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search;
    const isActive = req.query.isActive;
    const city = req.query.city;

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (isActive !== undefined) {
      whereConditions.push('is_active = ?');
      params.push(isActive === 'true');
    }

    if (city) {
      whereConditions.push('city LIKE ?');
      params.push(`%${city}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Requête pour le total
    const countQuery = `SELECT COUNT(*) as total FROM clients ${whereClause}`;

    // Requête principale
    const query = `
      SELECT 
        id,
        company_name,
        contact_person,
        email,
        phone,
        address,
        city,
        postal_code,
        country,
        is_active,
        created_at,
        updated_at
      FROM clients
      ${whereClause}
      ORDER BY company_name ASC
      LIMIT ? OFFSET ?
    `;

    const [countResult, clients] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(query, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult[0].total / limit),
          totalItems: countResult[0].total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/clients/:id - Récupérer un client spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const clients = await executeQuery(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Récupération des statistiques du client
    const stats = await executeQuery(`
      SELECT 
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as completed_orders,
        SUM(o.total_amount) as total_value,
        MAX(o.order_date) as last_order_date
      FROM orders o
      WHERE o.client_id = ?
    `, [clientId]);

    // Dernières commandes
    const recentOrders = await executeQuery(`
      SELECT 
        id,
        order_number,
        status,
        order_date,
        total_amount
      FROM orders
      WHERE client_id = ?
      ORDER BY order_date DESC
      LIMIT 5
    `, [clientId]);

    res.json({
      success: true,
      data: {
        client: clients[0],
        stats: stats[0],
        recentOrders
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/clients - Créer un nouveau client
router.post('/', [authenticateToken, authorizeRoles('admin', 'manager'), ...validateClient], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const {
      companyName,
      contactPerson = '',
      email = '',
      phone = '',
      address = '',
      city = '',
      postalCode = '',
      country = 'Sénégal'
    } = req.body;

    // Vérification que le client n'existe pas déjà
    const existingClients = await executeQuery(
      'SELECT id FROM clients WHERE company_name = ? AND email = ?',
      [companyName, email]
    );

    if (existingClients.length > 0 && email) {
      return res.status(409).json({
        success: false,
        message: 'Un client avec ce nom d\'entreprise et cet email existe déjà'
      });
    }

    // Création du client
    const result = await executeQuery(
      `INSERT INTO clients 
       (company_name, contact_person, email, phone, address, city, postal_code, country) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyName, contactPerson, email, phone, address, city, postalCode, country]
    );

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: {
        clientId: result.insertId,
        companyName
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/clients/:id - Mettre à jour un client
router.put('/:id', [authenticateToken, authorizeRoles('admin', 'manager'), ...validateClient], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const clientId = parseInt(req.params.id);
    const {
      companyName,
      contactPerson,
      email,
      phone,
      address,
      city,
      postalCode,
      country
    } = req.body;

    // Vérification que le client existe
    const existingClients = await executeQuery(
      'SELECT id FROM clients WHERE id = ?',
      [clientId]
    );

    if (existingClients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Construction de la requête de mise à jour dynamique
    let updateFields = [];
    let updateParams = [];

    if (companyName !== undefined) {
      updateFields.push('company_name = ?');
      updateParams.push(companyName);
    }

    if (contactPerson !== undefined) {
      updateFields.push('contact_person = ?');
      updateParams.push(contactPerson);
    }

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }

    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateParams.push(phone);
    }

    if (address !== undefined) {
      updateFields.push('address = ?');
      updateParams.push(address);
    }

    if (city !== undefined) {
      updateFields.push('city = ?');
      updateParams.push(city);
    }

    if (postalCode !== undefined) {
      updateFields.push('postal_code = ?');
      updateParams.push(postalCode);
    }

    if (country !== undefined) {
      updateFields.push('country = ?');
      updateParams.push(country);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(clientId);

    const updateQuery = `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`;

    await executeQuery(updateQuery, updateParams);

    res.json({
      success: true,
      message: 'Client mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/clients/:id/toggle-status - Activer/désactiver un client
router.put('/:id/toggle-status', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    // Vérification que le client existe
    const clients = await executeQuery(
      'SELECT id, is_active, company_name FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const client = clients[0];
    const newStatus = !client.is_active;

    // Vérification s'il y a des commandes en cours avant de désactiver
    if (!newStatus) {
      const activeOrders = await executeQuery(
        'SELECT COUNT(*) as count FROM orders WHERE client_id = ? AND status NOT IN ("delivered", "cancelled")',
        [clientId]
      );

      if (activeOrders[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de désactiver ce client car il a des commandes en cours',
          activeOrders: activeOrders[0].count
        });
      }
    }

    await executeQuery(
      'UPDATE clients SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, clientId]
    );

    res.json({
      success: true,
      message: `Client ${newStatus ? 'activé' : 'désactivé'} avec succès`,
      data: {
        clientId,
        companyName: client.company_name,
        isActive: newStatus
      }
    });

  } catch (error) {
    console.error('Erreur lors du changement de statut du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// DELETE /api/clients/:id - Supprimer un client (admin seulement)
router.delete('/:id', [authenticateToken, authorizeRoles('admin')], async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    // Vérification que le client existe
    const clients = await executeQuery(
      'SELECT id, company_name FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Vérification des dépendances (commandes)
    const orders = await executeQuery(
      'SELECT COUNT(*) as count FROM orders WHERE client_id = ?',
      [clientId]
    );

    if (orders[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce client car il a des commandes associées',
        orderCount: orders[0].count
      });
    }

    // Suppression du client
    await executeQuery('DELETE FROM clients WHERE id = ?', [clientId]);

    res.json({
      success: true,
      message: 'Client supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/clients/:id/orders - Récupérer les commandes d'un client
router.get('/:id/orders', authenticateToken, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    // Vérification que le client existe
    const clients = await executeQuery(
      'SELECT id, company_name FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    let whereConditions = ['client_id = ?'];
    let params = [clientId];

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // Requête pour le total
    const countQuery = `SELECT COUNT(*) as total FROM orders ${whereClause}`;

    // Requête principale
    const query = `
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.order_date,
        o.delivery_date,
        o.total_amount,
        o.notes,
        o.created_at,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM orders o
      JOIN users u ON o.created_by = u.id
      ${whereClause}
      ORDER BY o.order_date DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, orders] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(query, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        client: clients[0],
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult[0].total / limit),
          totalItems: countResult[0].total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des commandes du client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/clients/stats/overview - Statistiques globales des clients
router.get('/stats/overview', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    // Statistiques générales
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_clients,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_clients_30d,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as new_clients_7d
      FROM clients
    `);

    // Top clients par nombre de commandes
    const topClientsByOrders = await executeQuery(`
      SELECT 
        c.id,
        c.company_name,
        c.contact_person,
        c.city,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_value
      FROM clients c
      LEFT JOIN orders o ON c.id = o.client_id
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.company_name, c.contact_person, c.city
      ORDER BY order_count DESC
      LIMIT 10
    `);

    // Top clients par valeur des commandes
    const topClientsByValue = await executeQuery(`
      SELECT 
        c.id,
        c.company_name,
        c.contact_person,
        c.city,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_value
      FROM clients c
      LEFT JOIN orders o ON c.id = o.client_id
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.company_name, c.contact_person, c.city
      ORDER BY total_value DESC
      LIMIT 10
    `);

    // Répartition par ville
    const cityDistribution = await executeQuery(`
      SELECT 
        city,
        COUNT(*) as client_count
      FROM clients
      WHERE is_active = TRUE AND city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY client_count DESC
      LIMIT 10
    `);

    // Clients sans commandes
    const clientsWithoutOrders = await executeQuery(`
      SELECT 
        c.id,
        c.company_name,
        c.contact_person,
        c.created_at
      FROM clients c
      LEFT JOIN orders o ON c.id = o.client_id
      WHERE c.is_active = TRUE AND o.id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        topClientsByOrders,
        topClientsByValue,
        cityDistribution,
        clientsWithoutOrders
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques des clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/clients/search - Recherche rapide de clients
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La requête de recherche doit contenir au moins 2 caractères'
      });
    }

    const searchPattern = `%${query}%`;

    const clients = await executeQuery(`
      SELECT 
        id,
        company_name,
        contact_person,
        email,
        phone,
        city
      FROM clients
      WHERE is_active = TRUE 
        AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone LIKE ?)
      ORDER BY company_name ASC
      LIMIT ?
    `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);

    res.json({
      success: true,
      data: clients
    });

  } catch (error) {
    console.error('Erreur lors de la recherche de clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
