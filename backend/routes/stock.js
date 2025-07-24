const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/stock/pba - Récupérer les stocks PBA
router.get('/pba', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.pba_product_id,
        s.initial_stock as initialStock,
        s.current_stock as currentStock,
        s.total_produced as totalProduced,
        s.total_delivered as totalDelivered,
        s.last_updated,
        p.code,
        p.name,
        p.category,
        p.unit_price
      FROM pba_stock s
      JOIN pba_products p ON s.pba_product_id = p.id
      ORDER BY p.code
    `;

    const stocks = await executeQuery(query);

    res.json({
      success: true,
      data: stocks
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des stocks PBA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/stock/armatures - Récupérer les stocks d'armatures
router.get('/armatures', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Requête pour le total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM armature_stock s 
      JOIN armatures a ON s.armature_id = a.id
    `;

    // Requête principale
    const query = `
      SELECT 
        s.id,
        s.armature_id,
        s.current_stock,
        s.total_entries,
        s.last_updated,
        a.code,
        a.name,
        a.unit_price
      FROM armature_stock s
      JOIN armatures a ON s.armature_id = a.id
      ORDER BY a.code
      LIMIT ? OFFSET ?
    `;

    const [countResult, stocks] = await Promise.all([
      executeQuery(countQuery),
      executeQuery(query, [limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        stocks,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult[0].total / limit),
          totalItems: countResult[0].total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des stocks d\'armatures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/stock/materials - Récupérer les stocks de matériaux
router.get('/materials', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.material_id,
        s.current_stock as currentStock,
        s.unit,
        s.last_updated,
        m.code,
        m.name,
        m.category,
        m.unit_price
      FROM material_stock s
      JOIN materials m ON s.material_id = m.id
      ORDER BY m.code
    `;

    const stocks = await executeQuery(query);

    res.json({
      success: true,
      data: stocks
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des stocks de matériaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/stock/movements/pba - Récupérer l'historique des mouvements de stock PBA
router.get('/movements/pba', authenticateToken, async (req, res) => {
  try {
    const productId = req.query.productId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const movementType = req.query.movementType;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (productId) {
      whereConditions.push('sm.pba_product_id = ?');
      params.push(productId);
    }

    if (startDate) {
      whereConditions.push('DATE(sm.created_at) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('DATE(sm.created_at) <= ?');
      params.push(endDate);
    }

    if (movementType) {
      whereConditions.push('sm.movement_type = ?');
      params.push(movementType);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Requête pour le total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM pba_stock_movements sm 
      JOIN pba_products p ON sm.pba_product_id = p.id 
      ${whereClause}
    `;

    // Requête principale
    const query = `
      SELECT 
        sm.id,
        sm.movement_type,
        sm.quantity,
        sm.reference_type,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        p.code as product_code,
        p.name as product_name,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM pba_stock_movements sm
      JOIN pba_products p ON sm.pba_product_id = p.id
      JOIN users u ON sm.created_by = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, movements] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(query, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
        movements,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(countResult[0].total / limit),
          totalItems: countResult[0].total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des mouvements de stock:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/stock/pba/manual-adjustment - Ajustement manuel du stock PBA
router.post('/pba/manual-adjustment', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('productId').isInt().withMessage('ID produit requis'),
  body('quantity').isInt().withMessage('Quantité requise'),
  body('adjustmentType').isIn(['add', 'remove', 'set']).withMessage('Type d\'ajustement invalide'),
  body('notes').optional().isString().withMessage('Notes invalides')
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

    const { productId, quantity, adjustmentType, notes = '' } = req.body;

    // Vérification que le produit existe
    const products = await executeQuery(
      'SELECT id FROM pba_products WHERE id = ?',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Récupération du stock actuel
    const currentStock = await executeQuery(
      'SELECT current_stock FROM pba_stock WHERE pba_product_id = ?',
      [productId]
    );

    if (currentStock.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock non trouvé'
      });
    }

    const currentQuantity = currentStock[0].current_stock;
    let newQuantity;
    let movementQuantity;

    // Calcul de la nouvelle quantité selon le type d'ajustement
    switch (adjustmentType) {
      case 'add':
        newQuantity = currentQuantity + quantity;
        movementQuantity = quantity;
        break;
      case 'remove':
        newQuantity = Math.max(0, currentQuantity - quantity);
        movementQuantity = -quantity;
        break;
      case 'set':
        newQuantity = quantity;
        movementQuantity = quantity - currentQuantity;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Type d\'ajustement invalide'
        });
    }

    // Préparation des requêtes de transaction
    const queries = [
      {
        query: `
          UPDATE pba_stock 
          SET current_stock = ?, last_updated = CURRENT_TIMESTAMP 
          WHERE pba_product_id = ?
        `,
        params: [newQuantity, productId]
      },
      {
        query: `
          INSERT INTO pba_stock_movements 
          (pba_product_id, movement_type, quantity, reference_type, notes, created_by) 
          VALUES (?, 'adjustment', ?, 'manual', ?, ?)
        `,
        params: [productId, movementQuantity, notes, req.user.id]
      }
    ];

    // Exécution de la transaction
    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Stock ajusté avec succès',
      data: {
        previousQuantity: currentQuantity,
        newQuantity,
        adjustment: movementQuantity
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajustement du stock:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/stock/pba/delivery - Enregistrer une livraison (sortie de stock)
router.post('/pba/delivery', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('productId').isInt().withMessage('ID produit requis'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
  body('orderId').optional().isInt().withMessage('ID commande invalide'),
  body('notes').optional().isString().withMessage('Notes invalides')
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

    const { productId, quantity, orderId, notes = '' } = req.body;

    // Vérification du stock disponible
    const currentStock = await executeQuery(
      'SELECT current_stock FROM pba_stock WHERE pba_product_id = ?',
      [productId]
    );

    if (currentStock.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock non trouvé'
      });
    }

    if (currentStock[0].current_stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock insuffisant',
        available: currentStock[0].current_stock,
        requested: quantity
      });
    }

    // Préparation des requêtes de transaction
    const queries = [
      {
        query: `
          UPDATE pba_stock 
          SET current_stock = current_stock - ?, 
              total_delivered = total_delivered + ?,
              last_updated = CURRENT_TIMESTAMP 
          WHERE pba_product_id = ?
        `,
        params: [quantity, quantity, productId]
      },
      {
        query: `
          INSERT INTO pba_stock_movements 
          (pba_product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) 
          VALUES (?, 'delivery', ?, ?, ?, ?, ?)
        `,
        params: [
          productId, 
          -quantity, 
          orderId ? 'order' : 'manual',
          orderId || null,
          notes,
          req.user.id
        ]
      }
    ];

    // Exécution de la transaction
    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Livraison enregistrée avec succès',
      data: {
        productId,
        deliveredQuantity: quantity,
        remainingStock: currentStock[0].current_stock - quantity
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la livraison:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/stock/armatures/entry - Enregistrer une entrée d'armatures
router.post('/armatures/entry', [
  authenticateToken,
  authorizeRoles('admin', 'manager', 'production'),
  body('armatureId').isInt().withMessage('ID armature requis'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
  body('notes').optional().isString().withMessage('Notes invalides')
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

    const { armatureId, quantity, notes = '' } = req.body;

    // Vérification que l'armature existe
    const armatures = await executeQuery(
      'SELECT id FROM armatures WHERE id = ?',
      [armatureId]
    );

    if (armatures.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Armature non trouvée'
      });
    }

    // Mise à jour du stock d'armatures
    await executeQuery(`
      UPDATE armature_stock 
      SET current_stock = current_stock + ?, 
          total_entries = total_entries + ?,
          last_updated = CURRENT_TIMESTAMP 
      WHERE armature_id = ?
    `, [quantity, quantity, armatureId]);

    res.json({
      success: true,
      message: 'Entrée d\'armature enregistrée avec succès',
      data: {
        armatureId,
        quantity
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'entrée d\'armature:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/stock/summary - Résumé des stocks
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    // Statistiques globales des stocks PBA
    const pbaStats = await executeQuery(`
      SELECT 
        COUNT(*) as total_products,
        SUM(current_stock) as total_stock,
        SUM(total_produced) as total_produced,
        SUM(total_delivered) as total_delivered,
        COUNT(CASE WHEN current_stock < 10 THEN 1 END) as low_stock_count
      FROM pba_stock s
      JOIN pba_products p ON s.pba_product_id = p.id
      WHERE p.is_active = TRUE
    `);

    // Statistiques des armatures
    const armatureStats = await executeQuery(`
      SELECT 
        COUNT(*) as total_armatures,
        SUM(current_stock) as total_stock,
        SUM(total_entries) as total_entries
      FROM armature_stock s
      JOIN armatures a ON s.armature_id = a.id
      WHERE a.is_active = TRUE
    `);

    // Statistiques des matériaux
    const materialStats = await executeQuery(`
      SELECT 
        COUNT(*) as total_materials,
        SUM(current_stock) as total_stock
      FROM material_stock s
      JOIN materials m ON s.material_id = m.id
      WHERE m.is_active = TRUE
    `);

    // Top 5 des produits les plus produits
    const topProducts = await executeQuery(`
      SELECT 
        p.code,
        p.name,
        s.total_produced,
        s.current_stock
      FROM pba_stock s
      JOIN pba_products p ON s.pba_product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY s.total_produced DESC
      LIMIT 5
    `);

    // Produits en stock faible
    const lowStockProducts = await executeQuery(`
      SELECT 
        p.code,
        p.name,
        s.current_stock
      FROM pba_stock s
      JOIN pba_products p ON s.pba_product_id = p.id
      WHERE p.is_active = TRUE AND s.current_stock < 10
      ORDER BY s.current_stock ASC
    `);

    res.json({
      success: true,
      data: {
        pba: {
          totalProducts: pbaStats[0].total_products,
          totalStock: pbaStats[0].total_stock,
          totalProduced: pbaStats[0].total_produced,
          totalDelivered: pbaStats[0].total_delivered,
          lowStockCount: pbaStats[0].low_stock_count
        },
        armatures: {
          totalArmatures: armatureStats[0].total_armatures,
          totalStock: armatureStats[0].total_stock,
          totalEntries: armatureStats[0].total_entries
        },
        materials: {
          totalMaterials: materialStats[0].total_materials,
          totalStock: materialStats[0].total_stock
        },
        topProducts,
        lowStockProducts
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du résumé des stocks:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/stock/pba/:productId/history - Historique détaillé d'un produit PBA
router.get('/pba/:productId/history', authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const days = parseInt(req.query.days) || 30;

    // Informations du produit
    const product = await executeQuery(`
      SELECT 
        p.code,
        p.name,
        p.category,
        s.current_stock,
        s.total_produced,
        s.total_delivered,
        s.initial_stock
      FROM pba_products p
      JOIN pba_stock s ON p.id = s.pba_product_id
      WHERE p.id = ?
    `, [productId]);

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    // Historique des mouvements
    const movements = await executeQuery(`
      SELECT 
        sm.movement_type,
        sm.quantity,
        sm.reference_type,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM pba_stock_movements sm
      JOIN users u ON sm.created_by = u.id
      WHERE sm.pba_product_id = ? AND sm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY sm.created_at DESC
    `, [productId, days]);

    // Statistiques de production par jour (derniers 30 jours)
    const dailyProduction = await executeQuery(`
      SELECT 
        DATE(sm.created_at) as date,
        SUM(CASE WHEN sm.movement_type = 'production' THEN sm.quantity ELSE 0 END) as produced,
        SUM(CASE WHEN sm.movement_type = 'delivery' THEN ABS(sm.quantity) ELSE 0 END) as delivered
      FROM pba_stock_movements sm
      WHERE sm.pba_product_id = ? AND sm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(sm.created_at)
      ORDER BY date DESC
    `, [productId, days]);

    res.json({
      success: true,
      data: {
        product: product[0],
        movements,
        dailyProduction
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
