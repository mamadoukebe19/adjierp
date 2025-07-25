const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// POST /api/invoices - Créer une facture depuis une commande
router.post('/', [
  authenticateToken,
  authorizeRoles('admin', 'manager'),
  body('orderId').isInt().withMessage('ID commande requis'),
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

    const { orderId, dueDays, notes = '' } = req.body;

    // Vérification que la commande existe
    const orders = await executeQuery(
      'SELECT id, order_number, total_amount, status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
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

// GET /api/invoices - Récupérer toutes les factures
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.status,
        i.total_amount,
        i.paid_amount,
        i.notes,
        i.created_at,
        o.order_number,
        o.id as order_id,
        c.company_name as client_name
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      ORDER BY i.created_at DESC
    `;

    const invoices = await executeQuery(query);

    res.json({
      success: true,
      data: invoices
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/invoices/:id/pdf - Générer PDF de la facture
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const invoiceId = parseInt(req.params.id);
    
    const invoice = await executeQuery(`
      SELECT i.*, o.order_number, c.company_name, c.contact_person, c.address, c.city
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      WHERE i.id = ?
    `, [invoiceId]);
    
    if (invoice.length === 0) {
      return res.status(404).json({ success: false, message: 'Facture non trouvée' });
    }
    
    const items = await executeQuery(`
      SELECT oi.*, p.code, p.name
      FROM order_items oi
      JOIN pba_products p ON oi.pba_product_id = p.id
      WHERE oi.order_id = ?
    `, [invoice[0].order_id]);
    
    const payments = await executeQuery(`
      SELECT payment_date, amount, payment_method, reference
      FROM payments
      WHERE invoice_id = ?
      ORDER BY payment_date DESC
    `, [invoiceId]);
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${invoiceId}.pdf"`);
    
    doc.pipe(res);
    
    let yPos = 50;
    
    // En-tête
    doc.fontSize(20).text('FACTURE DOCC', 50, yPos);
    yPos += 40;
    
    doc.fontSize(12);
    doc.text(`N° Facture: ${invoice[0].invoice_number}`, 50, yPos);
    yPos += 20;
    doc.text(`Date: ${new Date(invoice[0].invoice_date).toLocaleDateString('fr-FR')}`, 50, yPos);
    yPos += 20;
    doc.text(`Échéance: ${new Date(invoice[0].due_date).toLocaleDateString('fr-FR')}`, 50, yPos);
    yPos += 30;
    
    // Client
    doc.fontSize(14).text('CLIENT:', 50, yPos);
    yPos += 20;
    doc.fontSize(10);
    doc.text(`${invoice[0].company_name}`, 70, yPos);
    yPos += 15;
    doc.text(`Contact: ${invoice[0].contact_person}`, 70, yPos);
    yPos += 15;
    doc.text(`Adresse: ${invoice[0].address}, ${invoice[0].city}`, 70, yPos);
    yPos += 30;
    
    // Articles
    doc.fontSize(14).text('ARTICLES:', 50, yPos);
    yPos += 20;
    doc.fontSize(10);
    
    items.forEach(item => {
      doc.text(`${item.code} - ${item.name}`, 70, yPos);
      doc.text(`${item.quantity} x ${item.unit_price} DA = ${item.total_price} DA`, 300, yPos);
      yPos += 20;
    });
    
    yPos += 10;
    doc.fontSize(12);
    doc.text(`TOTAL: ${invoice[0].total_amount} DA`, 50, yPos);
    yPos += 20;
    doc.text(`PAYÉ: ${invoice[0].paid_amount} DA`, 50, yPos);
    yPos += 20;
    doc.text(`RESTANT: ${invoice[0].total_amount - invoice[0].paid_amount} DA`, 50, yPos);
    yPos += 30;
    
    // Paiements
    if (payments.length > 0) {
      doc.fontSize(14).text('PAIEMENTS:', 50, yPos);
      yPos += 20;
      doc.fontSize(10);
      
      payments.forEach(payment => {
        doc.text(`${new Date(payment.payment_date).toLocaleDateString('fr-FR')} - ${payment.amount} DA (${payment.payment_method})`, 70, yPos);
        if (payment.reference) {
          doc.text(`Réf: ${payment.reference}`, 300, yPos);
        }
        yPos += 15;
      });
      yPos += 20;
    }
    
    if (invoice[0].notes) {
      doc.fontSize(10);
      doc.text(`Notes: ${invoice[0].notes}`, 50, yPos);
      yPos += 30;
    }
    
    doc.fontSize(8);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 50, yPos + 20);
    
    doc.end();
    
  } catch (error) {
    console.error('Erreur PDF facture:', error);
    res.status(500).json({ success: false, message: 'Erreur génération PDF' });
  }
});

module.exports = router;