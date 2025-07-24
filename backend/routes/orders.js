const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Validation pour création/mise à jour de commande
const validateOrder = [
  body('clientId').isInt().withMessage('ID client requis'),
  body('orderDate').isISO8601().withMessage('Date de commande invalide'),
  body('deliveryDate').optional().isISO8601().withMessage('Date de livraison invalide'),
  body('items').isArray({ min: 1 }).withMessage('Au moins un article est requis'),
  body('items.*.productId').isInt().withMessage('ID produit invalide'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('notes').optional().isString().withMessage('Les notes doivent être du texte')
];

// Génération automatique du numéro de commande
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Récupération du dernier numéro de commande pour cette année/mois
  const lastOrder = await executeQuery(`
    SELECT order_number 
    FROM orders 
    WHERE order_number LIKE 'CMD-${year}${month}-%' 
    ORDER BY id DESC 
    LIMIT 1
  `);

  let nextNumber = 1;
  if (lastOrder.length > 0) {
    const lastNumber = parseInt(lastOrder[0].order_number.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `CMD-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
};

// GET /api/orders - Récupérer toutes les commandes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const clientId = req.query.clientId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('o.status = ?');
      params.push(status);
    }

    if (clientId) {
      whereConditions.push('o.client_id = ?');
      params.push(clientId);
    }

    if (startDate) {
      whereConditions.push('o.order_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('o.order_date <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Requête pour le total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM orders o 
      JOIN clients c ON o.client_id = c.id 
      ${whereClause}
    `;

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
        o.updated_at,
        c.company_name as client_name,
        c.contact_person,
        c.city as client_city,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      JOIN users u ON o.created_by = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, orders] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(query, [...params, limit, offset])
    ]);

    res.json({
      success: true,
      data: {
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
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/orders/:id - Récupérer une commande spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    // Récupération de la commande
    const orders = await executeQuery(`
      SELECT 
        o.*,
        c.company_name as client_name,
        c.contact_person,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.postal_code as client_postal_code,
        c.country as client_country,
        u.username as created_by_username,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      JOIN users u ON o.created_by = u.id
      WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const order = orders[0];

    // Récupération des articles de la commande
    const items = await executeQuery(`
      SELECT 
        oi.id,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        p.category as product_category
      FROM order_items oi
      JOIN pba_products p ON oi.pba_product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY p.code
    `, [orderId]);

    // Récupération du devis associé (s'il existe)
    const quotes = await executeQuery(`
      SELECT 
        id,
        quote_number,
        quote_date,
        validity_date,
        status,
        total_amount,
        notes
      FROM quotes
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [orderId]);

    // Récupération de la facture associée (si elle existe)
    const invoices = await executeQuery(`
      SELECT 
        id,
        invoice_number,
        invoice_date,
        due_date,
        status,
        total_amount,
        paid_amount,
        notes
      FROM invoices
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [orderId]);

    // Récupération des paiements (s'il y en a)
    let payments = [];
    if (invoices.length > 0) {
      payments = await executeQuery(`
        SELECT 
          id,
          payment_date,
          amount,
          payment_method,
          reference,
          notes
        FROM payments
        WHERE invoice_id = ?
        ORDER BY payment_date DESC
      `, [invoices[0].id]);
    }

    res.json({
      success: true,
      data: {
        order,
        items,
        quote: quotes.length > 0 ? quotes[0] : null,
        invoice: invoices.length > 0 ? invoices[0] : null,
        payments
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/orders - Créer une nouvelle commande
router.post('/', [authenticateToken, authorizeRoles('admin', 'manager'), ...validateOrder], async (req, res) => {
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
      clientId,
      orderDate,
      deliveryDate,
      items,
      notes = ''
    } = req.body;

    // Vérification que le client existe et est actif
    const clients = await executeQuery(
      'SELECT id, company_name FROM clients WHERE id = ? AND is_active = TRUE',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé ou inactif'
      });
    }

    // Vérification que tous les produits existent
    const productIds = items.map(item => item.productId);
    const products = await executeQuery(
      `SELECT id, code, name, unit_price FROM pba_products WHERE id IN (${productIds.map(() => '?').join(',')}) AND is_active = TRUE`,
      productIds
    );

    if (products.length !== items.length) {
      return res.status(400).json({
        success: false,
        message: 'Certains produits sont introuvables ou inactifs'
      });
    }

    // Calcul du montant total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Génération du numéro de commande
    const orderNumber = await generateOrderNumber();

    // Préparation des requêtes de transaction
    const queries = [];

    // Création de la commande
    queries.push({
      query: `
        INSERT INTO orders 
        (order_number, client_id, status, order_date, delivery_date, total_amount, notes, created_by) 
        VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)
      `,
      params: [orderNumber, clientId, orderDate, deliveryDate || null, totalAmount, notes, req.user.id]
    });

    // Exécution de la première requête pour obtenir l'ID de la commande
    const orderResult = await executeQuery(
      `INSERT INTO orders 
       (order_number, client_id, status, order_date, delivery_date, total_amount, notes, created_by) 
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
      [orderNumber, clientId, orderDate, deliveryDate || null, totalAmount, notes, req.user.id]
    );

    const orderId = orderResult.insertId;

    // Préparation des requêtes pour les articles
    const itemQueries = [];
    for (const item of items) {
      const totalPrice = item.quantity * item.unitPrice;
      itemQueries.push({
        query: 'INSERT INTO order_items (order_id, pba_product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        params: [orderId, item.productId, item.quantity, item.unitPrice, totalPrice]
      });
    }

    // Exécution des requêtes d'articles
    if (itemQueries.length > 0) {
      await executeTransaction(itemQueries);
    }

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: {
        orderId,
        orderNumber,
        totalAmount,
        status: 'draft'
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/orders/:id/confirm - Confirmer une commande (passage au statut confirmed)
router.put('/:id/confirm', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    // Vérification que la commande existe et est en brouillon
    const orders = await executeQuery(
      'SELECT id, order_number, status FROM orders WHERE id = ? AND status = "draft"',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée ou déjà confirmée'
      });
    }

    // Mise à jour du statut
    await executeQuery(
      'UPDATE orders SET status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [orderId]
    );

    res.json({
      success: true,
      message: 'Commande confirmée avec succès',
      data: {
        orderId,
        orderNumber: orders[0].order_number,
        status: 'confirmed'
      }
    });

  } catch (error) {
    console.error('Erreur lors de la confirmation de la commande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/orders/:id/quote - Créer un devis pour une commande
router.post('/:id/quote', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('validityDays').isInt({ min: 1, max: 365 }).withMessage('Nombre de jours de validité invalide'),
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

    const orderId = parseInt(req.params.id);
    const { validityDays, notes = '' } = req.body;

    // Vérification que la commande existe et est confirmée
    const orders = await executeQuery(
      'SELECT id, order_number, total_amount, status FROM orders WHERE id = ? AND status = "confirmed"',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée ou pas encore confirmée'
      });
    }

    const order = orders[0];

    // Vérification qu'il n'y a pas déjà un devis accepté
    const existingQuotes = await executeQuery(
      'SELECT id FROM quotes WHERE order_id = ? AND status = "accepted"',
      [orderId]
    );

    if (existingQuotes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un devis a déjà été accepté pour cette commande'
      });
    }

    // Génération du numéro de devis
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastQuote = await executeQuery(`
      SELECT quote_number 
      FROM quotes 
      WHERE quote_number LIKE 'DEV-${year}${month}-%' 
      ORDER BY id DESC 
      LIMIT 1
    `);

    let nextNumber = 1;
    if (lastQuote.length > 0) {
      const lastNumber = parseInt(lastQuote[0].quote_number.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const quoteNumber = `DEV-${year}${month}-${String(nextNumber).padStart(4, '0')}`;

    // Dates
    const quoteDate = new Date().toISOString().split('T')[0];
    const validityDate = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // Création du devis
    const result = await executeQuery(`
      INSERT INTO quotes 
      (quote_number, order_id, quote_date, validity_date, status, total_amount, notes, created_by) 
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [quoteNumber, orderId, quoteDate, validityDate, order.total_amount, notes, req.user.id]);

    // Mise à jour du statut de la commande
    await executeQuery(
      'UPDATE orders SET status = "quoted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      message: 'Devis créé avec succès',
      data: {
        quoteId: result.insertId,
        quoteNumber,
        orderId,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        validityDate
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du devis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/orders/:id/quote/accept - Accepter un devis
router.put('/:id/quote/accept', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    // Récupération du devis en cours
    const quotes = await executeQuery(
      'SELECT id, quote_number, status, validity_date FROM quotes WHERE order_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1',
      [orderId]
    );

    if (quotes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun devis en attente trouvé pour cette commande'
      });
    }

    const quote = quotes[0];

    // Vérification de la validité du devis
    const today = new Date().toISOString().split('T')[0];
    if (quote.validity_date < today) {
      return res.status(400).json({
        success: false,
        message: 'Le devis a expiré'
      });
    }

    // Mise à jour du devis et de la commande
    const queries = [
      {
        query: 'UPDATE quotes SET status = "accepted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [quote.id]
      },
      {
        query: 'UPDATE orders SET status = "paid", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [orderId]
      }
    ];

    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Devis accepté avec succès',
      data: {
        quoteId: quote.id,
        quoteNumber: quote.quote_number,
        orderId
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'acceptation du devis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/orders/:id/invoice - Créer une facture pour une commande
router.post('/:id/invoice', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('dueDays').isInt({ min: 1, max: 365 }).withMessage('Nombre de jours d\'échéance invalide'),
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

    const orderId = parseInt(req.params.id);
    const { dueDays, notes = '' } = req.body;

    // Vérification que la commande existe et que le devis est accepté
    const orders = await executeQuery(
      'SELECT id, order_number, total_amount, status FROM orders WHERE id = ? AND status = "paid"',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée ou devis pas encore accepté'
      });
    }

    const order = orders[0];

    // Vérification qu'il n'y a pas déjà une facture
    const existingInvoices = await executeQuery(
      'SELECT id FROM invoices WHERE order_id = ?',
      [orderId]
    );

    if (existingInvoices.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une facture existe déjà pour cette commande'
      });
    }

    // Génération du numéro de facture
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastInvoice = await executeQuery(`
      SELECT invoice_number 
      FROM invoices 
      WHERE invoice_number LIKE 'FACT-${year}${month}-%' 
      ORDER BY id DESC 
      LIMIT 1
    `);

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = parseInt(lastInvoice[0].invoice_number.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const invoiceNumber = `FACT-${year}${month}-${String(nextNumber).padStart(4, '0')}`;

    // Dates
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + (dueDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // Création de la facture
    const result = await executeQuery(`
      INSERT INTO invoices 
      (invoice_number, order_id, invoice_date, due_date, status, total_amount, paid_amount, notes, created_by) 
      VALUES (?, ?, ?, ?, 'draft', ?, 0.00, ?, ?)
    `, [invoiceNumber, orderId, invoiceDate, dueDate, order.total_amount, notes, req.user.id]);

    // Mise à jour du statut de la commande
    await executeQuery(
      'UPDATE orders SET status = "invoiced", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: {
        invoiceId: result.insertId,
        invoiceNumber,
        orderId,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        dueDate
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/orders/:id/payment - Enregistrer un paiement
router.post('/:id/payment', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  body('paymentMethod').isIn(['cash', 'check', 'transfer', 'card']).withMessage('Méthode de paiement invalide'),
  body('paymentDate').isISO8601().withMessage('Date de paiement invalide'),
  body('reference').optional().isString().withMessage('Référence invalide'),
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

    const orderId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentDate, reference = '', notes = '' } = req.body;

    // Récupération de la facture
    const invoices = await executeQuery(
      'SELECT id, invoice_number, total_amount, paid_amount FROM invoices WHERE order_id = ?',
      [orderId]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune facture trouvée pour cette commande'
      });
    }

    const invoice = invoices[0];
    const remainingAmount = invoice.total_amount - invoice.paid_amount;

    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Le montant du paiement dépasse le montant restant dû',
        remainingAmount
      });
    }

    const newPaidAmount = invoice.paid_amount + amount;
    const isFullyPaid = newPaidAmount >= invoice.total_amount;

    // Préparation des requêtes de transaction
    const queries = [
      {
        query: `
          INSERT INTO payments 
          (invoice_id, payment_date, amount, payment_method, reference, notes, created_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        params: [invoice.id, paymentDate, amount, paymentMethod, reference, notes, req.user.id]
      },
      {
        query: `
          UPDATE invoices 
          SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `,
        params: [newPaidAmount, isFullyPaid ? 'paid' : 'sent', invoice.id]
      }
    ];

    // Si la commande est entièrement payée, mettre à jour son statut
    if (isFullyPaid) {
      queries.push({
        query: 'UPDATE orders SET status = "delivered", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        params: [orderId]
      });
    }

    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: {
        orderId,
        invoiceNumber: invoice.invoice_number,
        paidAmount: amount,
        totalPaid: newPaidAmount,
        remainingAmount: invoice.total_amount - newPaidAmount,
        isFullyPaid
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/orders/stats/overview - Statistiques des commandes
router.get('/stats/overview', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    // Statistiques générales
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted_orders,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN status = 'invoiced' THEN 1 END) as invoiced_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        SUM(total_amount) as total_value,
        AVG(total_amount) as average_value,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as orders_30d
      FROM orders
    `);

    // Évolution mensuelle des commandes
    const monthlyOrders = await executeQuery(`
      SELECT 
        DATE_FORMAT(order_date, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total_amount) as total_value
      FROM orders
      WHERE order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(order_date, '%Y-%m')
      ORDER BY month DESC
    `);

    // Top produits commandés
    const topProducts = await executeQuery(`
      SELECT 
        p.code,
        p.name,
        p.category,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_value,
        COUNT(DISTINCT o.id) as order_count
      FROM order_items oi
      JOIN pba_products p ON oi.pba_product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY p.id, p.code, p.name, p.category
      ORDER BY total_quantity DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        monthlyOrders,
        topProducts
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques des commandes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
