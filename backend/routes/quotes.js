const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/quotes - Récupérer tous les devis
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        q.id,
        q.quote_number,
        q.quote_date,
        q.validity_date,
        q.status,
        q.total_amount,
        q.notes,
        q.created_at,
        o.order_number,
        c.company_name as client_name,
        o.id as order_id
      FROM quotes q
      JOIN orders o ON q.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      ORDER BY q.created_at DESC
    `;

    const quotes = await executeQuery(query);

    res.json({
      success: true,
      data: quotes
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des devis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/quotes/:id/pdf - Générer PDF du devis
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const quoteId = parseInt(req.params.id);
    
    const quote = await executeQuery(`
      SELECT q.*, o.order_number, c.company_name, c.contact_person, c.address, c.city
      FROM quotes q
      JOIN orders o ON q.order_id = o.id
      JOIN clients c ON o.client_id = c.id
      WHERE q.id = ?
    `, [quoteId]);
    
    if (quote.length === 0) {
      return res.status(404).json({ success: false, message: 'Devis non trouvé' });
    }
    
    const items = await executeQuery(`
      SELECT oi.*, p.code, p.name
      FROM order_items oi
      JOIN pba_products p ON oi.pba_product_id = p.id
      WHERE oi.order_id = ?
    `, [quote[0].order_id]);
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="devis-${quoteId}.pdf"`);
    
    doc.pipe(res);
    
    let yPos = 50;
    
    // En-tête
    doc.fontSize(20).text('DEVIS DOCC', 50, yPos);
    yPos += 40;
    
    doc.fontSize(12);
    doc.text(`N° Devis: ${quote[0].quote_number}`, 50, yPos);
    yPos += 20;
    doc.text(`Date: ${new Date(quote[0].quote_date).toLocaleDateString('fr-FR')}`, 50, yPos);
    yPos += 20;
    doc.text(`Validité: ${new Date(quote[0].validity_date).toLocaleDateString('fr-FR')}`, 50, yPos);
    yPos += 30;
    
    // Client
    doc.fontSize(14).text('CLIENT:', 50, yPos);
    yPos += 20;
    doc.fontSize(10);
    doc.text(`${quote[0].company_name}`, 70, yPos);
    yPos += 15;
    doc.text(`Contact: ${quote[0].contact_person}`, 70, yPos);
    yPos += 15;
    doc.text(`Adresse: ${quote[0].address}, ${quote[0].city}`, 70, yPos);
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
    doc.text(`TOTAL: ${quote[0].total_amount} DA`, 50, yPos);
    yPos += 30;
    
    if (quote[0].notes) {
      doc.fontSize(10);
      doc.text(`Notes: ${quote[0].notes}`, 50, yPos);
      yPos += 30;
    }
    
    doc.fontSize(8);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 50, yPos + 20);
    
    doc.end();
    
  } catch (error) {
    console.error('Erreur PDF devis:', error);
    res.status(500).json({ success: false, message: 'Erreur génération PDF' });
  }
});

module.exports = router;