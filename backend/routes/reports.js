const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { executeQuery, executeTransaction } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Validation pour création/mise à jour de rapport
const validateReport = [
  body('reportDate').isISO8601().withMessage('Format de date invalide'),
  body('firstName').notEmpty().withMessage('Le prénom est requis'),
  body('lastName').notEmpty().withMessage('Le nom de famille est requis'),
  body('pbaProduction').optional().isArray().withMessage('La production PBA doit être un tableau'),
  body('pbaProduction.*.productId').isInt().withMessage('ID produit invalide'),
  body('pbaProduction.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
  body('materialUsage').optional().isArray().withMessage('L\'utilisation de matériaux doit être un tableau'),
  body('materialUsage.*.materialId').isInt().withMessage('ID matériau invalide'),
  body('materialUsage.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantité invalide'),
  body('materialUsage.*.unit').isIn(['kg', 't', 'g', 'sac', 'barre']).withMessage('Unité invalide'),
  body('armatureProduction').optional().isArray().withMessage('La production d\'armatures doit être un tableau'),
  body('armatureProduction.*.armatureId').isInt().withMessage('ID armature invalide'),
  body('armatureProduction.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide'),
  body('personnel').optional().isArray().withMessage('Le personnel doit être un tableau'),
  body('personnel.*.position').isIn(['production', 'soudeur', 'ferrailleur', 'ouvrier', 'macon', 'manoeuvre']).withMessage('Position invalide'),
  body('personnel.*.quantity').isInt({ min: 1 }).withMessage('Nombre de personnel invalide'),
  body('observations').optional().isString().withMessage('Les observations doivent être du texte')
];

// GET /api/reports - Récupérer tous les rapports (avec pagination et filtres)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const userId = req.query.userId;
    const status = req.query.status;

    // Construction de la requête avec filtres
    let whereConditions = [];
    let params = [];

    if (startDate) {
      whereConditions.push('dr.report_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('dr.report_date <= ?');
      params.push(endDate);
    }

    if (userId && (req.user.role === 'admin' || req.user.role === 'manager')) {
      whereConditions.push('dr.user_id = ?');
      params.push(userId);
    } else if (req.user.role === 'user' || req.user.role === 'production') {
      // Les utilisateurs normaux ne voient que leurs propres rapports
      whereConditions.push('dr.user_id = ?');
      params.push(req.user.id);
    }

    if (status) {
      whereConditions.push('dr.status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Requête pour le total
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM daily_reports dr 
      JOIN users u ON dr.user_id = u.id 
      ${whereClause}
    `;

    // Requête principale
    const query = `
      SELECT 
        dr.id,
        dr.report_date,
        dr.first_name,
        dr.last_name,
        dr.observations,
        dr.status,
        dr.created_at,
        dr.updated_at,
        u.username,
        u.role as user_role
      FROM daily_reports dr
      JOIN users u ON dr.user_id = u.id
      ${whereClause}
      ORDER BY dr.report_date DESC, dr.created_at DESC
    `;

    const reports = await executeQuery(query, params);

    // Ajout du total PBA pour chaque rapport
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const pbaTotal = await executeQuery(`
          SELECT COALESCE(SUM(quantity), 0) as total
          FROM report_pba_production
          WHERE report_id = ?
        `, [report.id]);

        return {
          ...report,
          pbaTotal: pbaTotal[0].total
        };
      })
    );

    res.json({
      success: true,
      data: reportsWithDetails || []
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/reports/:id/pdf - Générer PDF du rapport
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const reportId = parseInt(req.params.id);
    
    const report = await executeQuery(`
      SELECT dr.*, u.username
      FROM daily_reports dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.id = ?
    `, [reportId]);
    
    if (report.length === 0) {
      return res.status(404).json({ success: false, message: 'Rapport non trouvé' });
    }

    // Récupération des détails du rapport
    const [pbaProduction, materialUsage, armatureProduction, personnel] = await Promise.all([
      executeQuery(`
        SELECT p.code, p.name, rpba.quantity
        FROM report_pba_production rpba
        JOIN pba_products p ON rpba.pba_product_id = p.id
        WHERE rpba.report_id = ? AND rpba.quantity > 0
        ORDER BY p.code
      `, [reportId]),
      executeQuery(`
        SELECT m.code, m.name, rmu.quantity, rmu.unit
        FROM report_material_usage rmu
        JOIN materials m ON rmu.material_id = m.id
        WHERE rmu.report_id = ? AND rmu.quantity > 0
        ORDER BY m.code
      `, [reportId]),
      executeQuery(`
        SELECT a.code, a.name, rap.quantity
        FROM report_armature_production rap
        JOIN armatures a ON rap.armature_id = a.id
        WHERE rap.report_id = ? AND rap.quantity > 0
        ORDER BY a.code
      `, [reportId]),
      executeQuery(`
        SELECT position, quantity
        FROM report_personnel
        WHERE report_id = ? AND quantity > 0
        ORDER BY position
      `, [reportId])
    ]);
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-${reportId}.pdf"`);
    
    doc.pipe(res);
    
    let yPos = 50;
    
    // En-tête
    doc.fontSize(20).text('RAPPORT JOURNALIER DOCC', 50, yPos);
    yPos += 40;
    
    doc.fontSize(12);
    doc.text(`Date: ${new Date(report[0].report_date).toLocaleDateString('fr-FR')}`, 50, yPos);
    yPos += 20;
    doc.text(`Auteur: ${report[0].first_name} ${report[0].last_name}`, 50, yPos);
    yPos += 20;
    doc.text(`Utilisateur: ${report[0].username}`, 50, yPos);
    yPos += 20;
    doc.text(`Statut: ${report[0].status}`, 50, yPos);
    yPos += 30;
    
    // Production PBA
    if (pbaProduction.length > 0) {
      doc.fontSize(14).text('Production PBA:', 50, yPos);
      yPos += 20;
      doc.fontSize(10);
      
      const totalPBA = pbaProduction.reduce((sum, item) => sum + item.quantity, 0);
      pbaProduction.forEach(item => {
        doc.text(`${item.code}: ${item.quantity}`, 70, yPos);
        yPos += 15;
      });
      doc.text(`Total PBA: ${totalPBA}`, 70, yPos);
      yPos += 25;
    }
    
    // Matériaux utilisés
    if (materialUsage.length > 0) {
      doc.fontSize(14).text('Matériaux utilisés:', 50, yPos);
      yPos += 20;
      doc.fontSize(10);
      
      materialUsage.forEach(item => {
        doc.text(`${item.code}: ${item.quantity}${item.unit}`, 70, yPos);
        yPos += 15;
      });
      yPos += 10;
    }
    
    // Armatures façonnées
    if (armatureProduction.length > 0) {
      doc.fontSize(14).text('Armatures façonnées:', 50, yPos);
      yPos += 20;
      doc.fontSize(10);
      
      const totalArmatures = armatureProduction.reduce((sum, item) => sum + item.quantity, 0);
      armatureProduction.forEach(item => {
        doc.text(`${item.code}: ${item.quantity}`, 70, yPos);
        yPos += 15;
      });
      doc.text(`Total armatures: ${totalArmatures}`, 70, yPos);
      yPos += 25;
    }
    
    // Personnel mobilisé
    if (personnel.length > 0) {
      doc.fontSize(14).text('Personnel mobilisé:', 50, yPos);
      yPos += 20;
      doc.fontSize(10);
      
      const totalPersonnel = personnel.reduce((sum, item) => sum + item.quantity, 0);
      personnel.forEach(item => {
        const position = item.position === 'macon' ? 'maçon' : 
                        item.position === 'manoeuvre' ? 'manœuvre' : item.position;
        doc.text(`${position}: ${item.quantity}`, 70, yPos);
        yPos += 15;
      });
      doc.text(`Total personnel: ${totalPersonnel}`, 70, yPos);
      yPos += 25;
    }
    
    // Observations
    if (report[0].observations) {
      doc.fontSize(14).text('Observations:', 50, yPos);
      yPos += 20;
      doc.fontSize(10).text(report[0].observations, 70, yPos, { width: 450 });
      yPos += 40;
    }
    
    // Pied de page
    doc.fontSize(8).text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 50, yPos + 20);
    
    doc.end();
    
  } catch (error) {
    console.error('Erreur PDF rapport:', error);
    res.status(500).json({ success: false, message: 'Erreur génération PDF' });
  }
});

// GET /api/reports/:id - Récupérer un rapport spécifique
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    // Vérification des permissions
    let query = `
      SELECT 
        dr.*,
        u.username,
        u.role as user_role
      FROM daily_reports dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.id = ?
    `;

    let params = [reportId];

    // Les utilisateurs normaux ne peuvent voir que leurs propres rapports
    if (req.user.role === 'user' || req.user.role === 'production') {
      query += ' AND dr.user_id = ?';
      params.push(req.user.id);
    }

    const reports = await executeQuery(query, params);

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    const report = reports[0];

    // Récupération des détails
    const [pbaProduction, materialUsage, armatureProduction, personnel] = await Promise.all([
      executeQuery(`
        SELECT 
          rpba.id,
          rpba.quantity,
          rpba.pba_product_id,
          p.code,
          p.name,
          p.category
        FROM report_pba_production rpba
        JOIN pba_products p ON rpba.pba_product_id = p.id
        WHERE rpba.report_id = ?
      `, [reportId]),

      executeQuery(`
        SELECT 
          rmu.id,
          rmu.quantity,
          rmu.unit,
          rmu.additional_info,
          rmu.material_id,
          m.code,
          m.name,
          m.category
        FROM report_material_usage rmu
        JOIN materials m ON rmu.material_id = m.id
        WHERE rmu.report_id = ?
      `, [reportId]),

      executeQuery(`
        SELECT 
          rap.id,
          rap.quantity,
          rap.armature_id,
          a.code,
          a.name
        FROM report_armature_production rap
        JOIN armatures a ON rap.armature_id = a.id
        WHERE rap.report_id = ?
      `, [reportId]),

      executeQuery(`
        SELECT 
          position,
          quantity
        FROM report_personnel
        WHERE report_id = ?
      `, [reportId])
    ]);

    res.json({
      success: true,
      data: {
        ...report,
        pbaProduction,
        materialUsage,
        armatureProduction,
        personnel
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/reports/complete - Créer un rapport complet
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const {
      reportDate,
      firstName,
      lastName,
      pbaProduction = [],
      materialUsage = [],
      armatureProduction = [],
      personnel = [],
      observations = ''
    } = req.body;

    // Création du rapport principal
    const reportResult = await executeQuery(
      'INSERT INTO daily_reports (user_id, report_date, first_name, last_name, observations) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, reportDate, firstName, lastName, observations]
    );

    const reportId = reportResult.insertId;
    const queries = [];

    // Ajout de la production PBA
    for (const production of pbaProduction) {
      queries.push({
        query: 'INSERT INTO report_pba_production (report_id, pba_product_id, quantity) VALUES (?, ?, ?)',
        params: [reportId, production.productId, production.quantity]
      });
    }

    // Ajout des matériaux utilisés
    for (const material of materialUsage) {
      queries.push({
        query: 'INSERT INTO report_material_usage (report_id, material_id, quantity, unit) VALUES (?, ?, ?, ?)',
        params: [reportId, material.materialId, material.quantity, material.unit]
      });
    }

    // Ajout des armatures façonnées
    for (const armature of armatureProduction) {
      queries.push({
        query: 'INSERT INTO report_armature_production (report_id, armature_id, quantity) VALUES (?, ?, ?)',
        params: [reportId, armature.armatureId, armature.quantity]
      });
    }

    // Ajout du personnel mobilisé
    for (const person of personnel) {
      queries.push({
        query: 'INSERT INTO report_personnel (report_id, position, quantity) VALUES (?, ?, ?)',
        params: [reportId, person.position, person.quantity]
      });
    }

    // Exécution de toutes les requêtes
    if (queries.length > 0) {
      await executeTransaction(queries);
    }

    // Mise à jour automatique des stocks
    const stockUpdateQueries = [];

    // Mise à jour du statut du rapport
    stockUpdateQueries.push({
      query: 'UPDATE daily_reports SET status = "submitted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      params: [reportId]
    });

    // Mise à jour des stocks PBA (addition)
    for (const production of pbaProduction) {
      if (production.quantity > 0) {
        stockUpdateQueries.push({
          query: `
            INSERT INTO pba_stock (pba_product_id, total_produced, last_updated) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
            total_produced = total_produced + VALUES(total_produced),
            last_updated = CURRENT_TIMESTAMP
          `,
          params: [production.productId, production.quantity]
        });

        stockUpdateQueries.push({
          query: `
            INSERT INTO pba_stock_movements 
            (pba_product_id, movement_type, quantity, reference_type, reference_id, created_by) 
            VALUES (?, 'production', ?, 'report', ?, ?)
          `,
          params: [production.productId, production.quantity, reportId, req.user.id]
        });
      }
    }

    // Mise à jour des stocks de matériaux (soustraction)
    for (const material of materialUsage) {
      if (material.quantity > 0) {
        stockUpdateQueries.push({
          query: `
            UPDATE material_stock 
            SET current_stock = GREATEST(0, current_stock - ?),
                last_updated = CURRENT_TIMESTAMP 
            WHERE material_id = ?
          `,
          params: [material.quantity, material.materialId]
        });

        stockUpdateQueries.push({
          query: `
            INSERT INTO material_stock_movements 
            (material_id, movement_type, quantity, reference_type, reference_id, created_by) 
            VALUES (?, 'usage', ?, 'report', ?, ?)
          `,
          params: [material.materialId, material.quantity, reportId, req.user.id]
        });
      }
    }

    // Mise à jour des stocks d'armatures (addition)
    for (const armature of armatureProduction) {
      if (armature.quantity > 0) {
        stockUpdateQueries.push({
          query: `
            UPDATE armature_stock 
            SET current_stock = current_stock + ?, 
                total_entries = total_entries + ?,
                last_updated = CURRENT_TIMESTAMP 
            WHERE armature_id = ?
          `,
          params: [armature.quantity, armature.quantity, armature.armatureId]
        });
      }
    }

    // Exécution des mises à jour de stock
    if (stockUpdateQueries.length > 0) {
      try {
        await executeTransaction(stockUpdateQueries);
      } catch (stockError) {
        console.error('Erreur mise à jour stocks:', stockError);
        // Rollback du rapport si erreur de stock
        await executeQuery('DELETE FROM daily_reports WHERE id = ?', [reportId]);
        throw new Error('Erreur lors de la mise à jour des stocks');
      }
    }

    res.status(201).json({
      success: true,
      message: 'Rapport complet créé avec succès, stocks mis à jour',
      data: {
        reportId,
        reportDate,
        status: 'submitted'
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du rapport complet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// POST /api/reports - Créer un nouveau rapport (version simplifiée)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      reportDate,
      firstName,
      lastName,
      pbaProduction = {},
      observations = ''
    } = req.body;

    // Création du rapport principal
    const reportResult = await executeQuery(
      'INSERT INTO daily_reports (user_id, report_date, first_name, last_name, observations) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, reportDate, firstName, lastName, observations]
    );

    const reportId = reportResult.insertId;

    // Ajout de la production PBA simple
    const products = await executeQuery('SELECT id, code FROM pba_products WHERE is_active = TRUE');
    
    for (const product of products) {
      const quantity = pbaProduction[product.code] || 0;
      if (quantity > 0) {
        await executeQuery(
          'INSERT INTO report_pba_production (report_id, pba_product_id, quantity) VALUES (?, ?, ?)',
          [reportId, product.id, quantity]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Rapport créé avec succès',
      data: {
        reportId,
        reportDate,
        status: 'draft'
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// PUT /api/reports/:id/submit - Soumettre un rapport (met à jour les stocks)
router.put('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    // Vérification que le rapport existe et appartient à l'utilisateur
    const reports = await executeQuery(
      'SELECT * FROM daily_reports WHERE id = ? AND user_id = ? AND status = "draft"',
      [reportId, req.user.id]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé ou déjà soumis'
      });
    }

    // Préparation des requêtes de mise à jour des stocks
    const stockUpdateQueries = [];

    // Mise à jour du statut du rapport
    stockUpdateQueries.push({
      query: 'UPDATE daily_reports SET status = "submitted", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      params: [reportId]
    });

    // Récupération de la production PBA pour mise à jour des stocks
    const pbaProduction = await executeQuery(
      'SELECT pba_product_id, quantity FROM report_pba_production WHERE report_id = ?',
      [reportId]
    );

    // Mise à jour des stocks PBA
    for (const production of pbaProduction) {
      // Mise à jour du stock PBA
      stockUpdateQueries.push({
        query: `
          UPDATE pba_stock 
          SET total_produced = total_produced + ?,
              last_updated = CURRENT_TIMESTAMP 
          WHERE pba_product_id = ?
        `,
        params: [production.quantity, production.pba_product_id]
      });

      // Enregistrement du mouvement de stock
      stockUpdateQueries.push({
        query: `
          INSERT INTO pba_stock_movements 
          (pba_product_id, movement_type, quantity, reference_type, reference_id, created_by) 
          VALUES (?, 'production', ?, 'report', ?, ?)
        `,
        params: [production.pba_product_id, production.quantity, reportId, req.user.id]
      });
    }

    // Récupération de l'utilisation des matériaux pour mise à jour des stocks
    const materialUsage = await executeQuery(
      'SELECT material_id, quantity FROM report_material_usage WHERE report_id = ?',
      [reportId]
    );

    // Mise à jour des stocks de matériaux (soustraction)
    for (const usage of materialUsage) {
      stockUpdateQueries.push({
        query: `
          UPDATE material_stock 
          SET current_stock = GREATEST(0, current_stock - ?),
              last_updated = CURRENT_TIMESTAMP 
          WHERE material_id = ?
        `,
        params: [usage.quantity, usage.material_id]
      });

      // Enregistrement du mouvement de stock matériau
      stockUpdateQueries.push({
        query: `
          INSERT INTO material_stock_movements 
          (material_id, movement_type, quantity, reference_type, reference_id, created_by) 
          VALUES (?, 'usage', ?, 'report', ?, ?)
        `,
        params: [usage.material_id, usage.quantity, reportId, req.user.id]
      });
    }

    // Récupération de la production d'armatures pour mise à jour des stocks
    const armatureProduction = await executeQuery(
      'SELECT armature_id, quantity FROM report_armature_production WHERE report_id = ?',
      [reportId]
    );

    // Mise à jour des stocks d'armatures
    for (const production of armatureProduction) {
      stockUpdateQueries.push({
        query: `
          UPDATE armature_stock 
          SET current_stock = current_stock + ?, 
              total_entries = total_entries + ?,
              last_updated = CURRENT_TIMESTAMP 
          WHERE armature_id = ?
        `,
        params: [production.quantity, production.quantity, production.armature_id]
      });
    }

    // Exécution de toutes les mises à jour en transaction
    await executeTransaction(stockUpdateQueries);

    res.json({
      success: true,
      message: 'Rapport soumis avec succès, stocks mis à jour'
    });

  } catch (error) {
    console.error('Erreur lors de la soumission du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/reports/preview/:id - Prévisualisation du rapport
router.get('/preview/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    // Récupération du rapport avec tous les détails
    const report = await executeQuery(`
      SELECT 
        dr.report_date,
        dr.first_name,
        dr.last_name,
        dr.observations
      FROM daily_reports dr
      WHERE dr.id = ? AND (dr.user_id = ? OR ? IN ('admin', 'manager'))
    `, [reportId, req.user.id, req.user.role]);

    if (report.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    // Récupération des détails avec formatage pour prévisualisation
    const [pbaProduction, materialUsage, armatureProduction, personnel] = await Promise.all([
      executeQuery(`
        SELECT 
          p.name,
          p.code,
          rpba.quantity
        FROM report_pba_production rpba
        JOIN pba_products p ON rpba.pba_product_id = p.id
        WHERE rpba.report_id = ? AND rpba.quantity > 0
        ORDER BY p.code
      `, [reportId]),

      executeQuery(`
        SELECT 
          m.name,
          m.code,
          rmu.quantity,
          rmu.unit,
          rmu.additional_info
        FROM report_material_usage rmu
        JOIN materials m ON rmu.material_id = m.id
        WHERE rmu.report_id = ? AND rmu.quantity > 0
        ORDER BY m.code
      `, [reportId]),

      executeQuery(`
        SELECT 
          a.name,
          a.code,
          rap.quantity
        FROM report_armature_production rap
        JOIN armatures a ON rap.armature_id = a.id
        WHERE rap.report_id = ? AND rap.quantity > 0
        ORDER BY a.code
      `, [reportId]),

      executeQuery(`
        SELECT 
          position,
          quantity
        FROM report_personnel
        WHERE report_id = ? AND quantity > 0
        ORDER BY position
      `, [reportId])
    ]);

    // Formatage de la prévisualisation selon le format demandé
    const reportData = report[0];
    const formattedDate = new Date(reportData.report_date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let preview = `Rapport du ${formattedDate} – ${reportData.first_name} ${reportData.last_name}\n\n`;

    // PBA produits
    if (pbaProduction.length > 0) {
      const totalPBA = pbaProduction.reduce((sum, item) => sum + item.quantity, 0);
      pbaProduction.forEach(item => {
        preview += `${item.code} = ${item.quantity}\n`;
      });
      preview += `Total PBA : ${totalPBA}\n\n`;
    }

    // Matériaux utilisés
    if (materialUsage.length > 0) {
      preview += 'Matériaux utilisés : ';
      const materials = materialUsage.map(item => {
        let text = `${item.quantity}${item.unit} ${item.code}`;
        if (item.additional_info) {
          text += ` ${item.additional_info}`;
        }
        return text;
      });
      preview += materials.join(', ') + '\n\n';
    }

    // Armatures façonnées
    if (armatureProduction.length > 0) {
      preview += 'Armatures façonnées :\n';
      const totalArmatures = armatureProduction.reduce((sum, item) => sum + item.quantity, 0);
      armatureProduction.forEach(item => {
        preview += `${item.quantity} armature${item.quantity > 1 ? 's' : ''} ${item.code}\n`;
      });
      preview += `Total armatures : ${totalArmatures}\n\n`;
    }

    // Personnel mobilisé
    if (personnel.length > 0) {
      preview += 'Personnel mobilisé :\n';
      const totalPersonnel = personnel.reduce((sum, item) => sum + item.quantity, 0);
      personnel.forEach(item => {
        const position = item.position === 'macon' ? 'maçon' : 
                        item.position === 'manoeuvre' ? 'manœuvre' : item.position;
        preview += `${item.quantity} ${position}${item.quantity > 1 ? 's' : ''}\n`;
      });
      preview += `Total personnel : ${totalPersonnel}\n\n`;
    }

    // Observations
    if (reportData.observations) {
      preview += `Observations : ${reportData.observations}\n`;
    }

    res.json({
      success: true,
      data: {
        preview: preview.trim(),
        reportData: {
          ...reportData,
          pbaProduction,
          materialUsage,
          armatureProduction,
          personnel
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la prévisualisation du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// DELETE /api/reports/:id - Supprimer un rapport (seulement si en brouillon)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    // Vérification que le rapport existe et peut être supprimé
    const reports = await executeQuery(
      'SELECT status FROM daily_reports WHERE id = ? AND (user_id = ? OR ? = "admin")',
      [reportId, req.user.id, req.user.role]
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    if (reports[0].status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Seuls les rapports en brouillon peuvent être supprimés'
      });
    }

    // Suppression du rapport (CASCADE supprimera automatiquement les détails)
    await executeQuery('DELETE FROM daily_reports WHERE id = ?', [reportId]);

    res.json({
      success: true,
      message: 'Rapport supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/reports/data/products - Récupérer les produits PBA disponibles
router.get('/data/products', authenticateToken, async (req, res) => {
  try {
    const products = await executeQuery(
      'SELECT id, code, name, category FROM pba_products WHERE is_active = TRUE ORDER BY code'
    );

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/reports/data/materials - Récupérer les matériaux disponibles
router.get('/data/materials', authenticateToken, async (req, res) => {
  try {
    const materials = await executeQuery(
      'SELECT id, code, name, unit, category FROM materials WHERE is_active = TRUE ORDER BY code'
    );

    res.json({
      success: true,
      data: materials
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des matériaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/reports/data/armatures - Récupérer les armatures disponibles
router.get('/data/armatures', authenticateToken, async (req, res) => {
  try {
    const armatures = await executeQuery(
      'SELECT id, code, name FROM armatures WHERE is_active = TRUE ORDER BY code'
    );

    res.json({
      success: true,
      data: armatures
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des armatures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
