const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/overview - Vue d'ensemble globale (admin/manager)
router.get('/overview', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    // Statistiques générales en parallèle
    const [
      totalStats,
      recentReports,
      stockAlerts,
      pendingOrders,
      recentOrders,
      monthlyProduction,
      topProducts
    ] = await Promise.all([
      // Statistiques totales
      executeQuery(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
          (SELECT COUNT(*) FROM clients WHERE is_active = TRUE) as active_clients,
          (SELECT COUNT(*) FROM daily_reports WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as reports_30d,
          (SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled', 'delivered')) as pending_orders,
          (SELECT SUM(total_amount) FROM orders WHERE status = 'delivered' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as revenue_30d,
          (SELECT SUM(current_stock) FROM pba_stock) as total_pba_stock,
          (SELECT COUNT(*) FROM pba_stock WHERE current_stock < 10) as low_stock_items
      `),

      // Rapports récents
      executeQuery(`
        SELECT 
          dr.id,
          dr.report_date,
          dr.first_name,
          dr.last_name,
          dr.status,
          dr.created_at,
          u.username,
          COUNT(rpba.id) as pba_count,
          COUNT(rap.id) as armature_count
        FROM daily_reports dr
        JOIN users u ON dr.user_id = u.id
        LEFT JOIN report_pba_production rpba ON dr.id = rpba.report_id
        LEFT JOIN report_armature_production rap ON dr.id = rap.report_id
        GROUP BY dr.id, dr.report_date, dr.first_name, dr.last_name, dr.status, dr.created_at, u.username
        ORDER BY dr.created_at DESC
        LIMIT 10
      `),

      // Alertes de stock faible
      executeQuery(`
        SELECT 
          p.code,
          p.name,
          p.category,
          s.current_stock,
          s.total_produced,
          s.total_delivered
        FROM pba_stock s
        JOIN pba_products p ON s.pba_product_id = p.id
        WHERE s.current_stock < 10 AND p.is_active = TRUE
        ORDER BY s.current_stock ASC
        LIMIT 10
      `),

      // Commandes en attente
      executeQuery(`
        SELECT 
          o.id,
          o.order_number,
          o.status,
          o.order_date,
          o.total_amount,
          c.company_name as client_name,
          DATEDIFF(NOW(), o.created_at) as days_pending
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        WHERE o.status NOT IN ('cancelled', 'delivered')
        ORDER BY o.created_at ASC
        LIMIT 10
      `),

      // Commandes récentes
      executeQuery(`
        SELECT 
          o.id,
          o.order_number,
          o.status,
          o.order_date,
          o.total_amount,
          c.company_name as client_name
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        ORDER BY o.created_at DESC
        LIMIT 5
      `),

      // Production mensuelle des 6 derniers mois
      executeQuery(`
        SELECT 
          DATE_FORMAT(dr.report_date, '%Y-%m') as month,
          SUM(rpba.quantity) as total_produced,
          COUNT(DISTINCT dr.id) as report_count,
          COUNT(DISTINCT dr.user_id) as active_users
        FROM daily_reports dr
        JOIN report_pba_production rpba ON dr.id = rpba.report_id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND dr.status = 'submitted'
        GROUP BY DATE_FORMAT(dr.report_date, '%Y-%m')
        ORDER BY month DESC
      `),

      // Top 5 produits les plus produits ce mois
      executeQuery(`
        SELECT 
          p.code,
          p.name,
          p.category,
          SUM(rpba.quantity) as total_produced,
          COUNT(DISTINCT dr.id) as report_count
        FROM report_pba_production rpba
        JOIN pba_products p ON rpba.pba_product_id = p.id
        JOIN daily_reports dr ON rpba.report_id = dr.id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND dr.status = 'submitted'
        GROUP BY p.id, p.code, p.name, p.category
        ORDER BY total_produced DESC
        LIMIT 5
      `)
    ]);

    res.json({
      success: true,
      data: {
        totalStats: totalStats[0],
        recentReports,
        stockAlerts,
        pendingOrders,
        recentOrders,
        monthlyProduction,
        topProducts
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/dashboard/production-stats - Statistiques de production détaillées
router.get('/production-stats', [authenticateToken, authorizeRoles('admin', 'manager')], async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const [
      dailyProduction,
      productionByCategory,
      productionByUser,
      materialUsage,
      personnelStats
    ] = await Promise.all([
      // Production journalière
      executeQuery(`
        SELECT 
          dr.report_date,
          SUM(rpba.quantity) as total_pba,
          COUNT(DISTINCT dr.id) as report_count,
          COUNT(DISTINCT dr.user_id) as user_count
        FROM daily_reports dr
        JOIN report_pba_production rpba ON dr.id = rpba.report_id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND dr.status = 'submitted'
        GROUP BY dr.report_date
        ORDER BY dr.report_date DESC
      `, [days]),

      // Production par catégorie
      executeQuery(`
        SELECT 
          p.category,
          SUM(rpba.quantity) as total_produced,
          COUNT(DISTINCT p.id) as product_types,
          AVG(rpba.quantity) as avg_per_report
        FROM report_pba_production rpba
        JOIN pba_products p ON rpba.pba_product_id = p.id
        JOIN daily_reports dr ON rpba.report_id = dr.id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND dr.status = 'submitted'
        GROUP BY p.category
        ORDER BY total_produced DESC
      `, [days]),

      // Production par utilisateur
      executeQuery(`
        SELECT 
          u.username,
          u.first_name,
          u.last_name,
          COUNT(dr.id) as report_count,
          SUM(rpba.quantity) as total_produced,
          AVG(rpba.quantity) as avg_per_report
        FROM users u
        JOIN daily_reports dr ON u.id = dr.user_id
        JOIN report_pba_production rpba ON dr.id = rpba.report_id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND dr.status = 'submitted'
        GROUP BY u.id, u.username, u.first_name, u.last_name
        ORDER BY total_produced DESC
        LIMIT 10
      `, [days]),

      // Utilisation des matériaux
      executeQuery(`
        SELECT 
          m.name,
          m.unit,
          m.category,
          SUM(rmu.quantity) as total_used,
          COUNT(DISTINCT dr.id) as usage_count,
          AVG(rmu.quantity) as avg_per_usage
        FROM report_material_usage rmu
        JOIN materials m ON rmu.material_id = m.id
        JOIN daily_reports dr ON rmu.report_id = dr.id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND dr.status = 'submitted'
        GROUP BY m.id, m.name, m.unit, m.category
        ORDER BY total_used DESC
      `, [days]),

      // Statistiques du personnel
      executeQuery(`
        SELECT 
          rp.position,
          SUM(rp.quantity) as total_personnel,
          COUNT(DISTINCT dr.id) as report_count,
          AVG(rp.quantity) as avg_per_report
        FROM report_personnel rp
        JOIN daily_reports dr ON rp.report_id = dr.id
        WHERE dr.report_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND dr.status = 'submitted'
        GROUP BY rp.position
        ORDER BY total_personnel DESC
      `, [days])
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} derniers jours`,
        dailyProduction,
        productionByCategory,
        productionByUser,
        materialUsage,
        personnelStats
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de production:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/dashboard/user-overview - Vue d'ensemble pour utilisateur normal
router.get('/user-overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      userStats,
      recentReports,
      monthlyActivity,
      stockSummary
    ] = await Promise.all([
      // Statistiques personnelles de l'utilisateur
      executeQuery(`
        SELECT 
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as reports_30d,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as reports_7d,
          COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_reports,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_reports,
          MAX(created_at) as last_report_date
        FROM daily_reports
        WHERE user_id = ?
      `, [userId]),

      // Rapports récents de l'utilisateur
      executeQuery(`
        SELECT 
          dr.id,
          dr.report_date,
          dr.first_name,
          dr.last_name,
          dr.status,
          dr.created_at,
          COUNT(rpba.id) as pba_count,
          COUNT(rap.id) as armature_count
        FROM daily_reports dr
        LEFT JOIN report_pba_production rpba ON dr.id = rpba.report_id
        LEFT JOIN report_armature_production rap ON dr.id = rap.report_id
        WHERE dr.user_id = ?
        GROUP BY dr.id, dr.report_date, dr.first_name, dr.last_name, dr.status, dr.created_at
        ORDER BY dr.created_at DESC
        LIMIT 10
      `, [userId]),

      // Activité mensuelle de l'utilisateur
      executeQuery(`
        SELECT 
          DATE_FORMAT(report_date, '%Y-%m') as month,
          COUNT(*) as report_count,
          COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count
        FROM daily_reports
        WHERE user_id = ? AND report_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(report_date, '%Y-%m')
        ORDER BY month DESC
      `, [userId]),

      // Résumé des stocks (visible par tous)
      executeQuery(`
        SELECT 
          COUNT(*) as total_products,
          SUM(current_stock) as total_stock,
          COUNT(CASE WHEN current_stock < 10 THEN 1 END) as low_stock_count
        FROM pba_stock s
        JOIN pba_products p ON s.pba_product_id = p.id
        WHERE p.is_active = TRUE
      `)
    ]);

    res.json({
      success: true,
      data: {
        userStats: userStats[0],
        recentReports,
        monthlyActivity,
        stockSummary: stockSummary[0]
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/dashboard/quick-stats - Statistiques rapides pour la barre de navigation
router.get('/quick-stats', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';
    const userId = req.user.id;

    let statsQuery;
    let params = [];

    if (isAdmin) {
      // Statistiques globales pour admin/manager
      statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM daily_reports WHERE created_at >= CURDATE() AND status = 'draft') as draft_reports_today,
          (SELECT COUNT(*) FROM orders WHERE status IN ('draft', 'confirmed', 'quoted')) as pending_orders,
          (SELECT COUNT(*) FROM pba_stock WHERE current_stock < 10) as low_stock_alerts,
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users
      `;
    } else {
      // Statistiques personnelles pour utilisateur normal
      statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM daily_reports WHERE user_id = ? AND created_at >= CURDATE() AND status = 'draft') as draft_reports_today,
          (SELECT COUNT(*) FROM daily_reports WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as reports_week,
          (SELECT COUNT(*) FROM pba_stock WHERE current_stock < 10) as low_stock_alerts,
          0 as pending_orders
      `;
      params = [userId, userId];
    }

    const stats = await executeQuery(statsQuery, params);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques rapides:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/dashboard/alerts - Alertes et notifications
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';
    const alerts = [];

    // Alertes de stock faible (visible par tous)
    const lowStockItems = await executeQuery(`
      SELECT 
        p.code,
        p.name,
        s.current_stock
      FROM pba_stock s
      JOIN pba_products p ON s.pba_product_id = p.id
      WHERE s.current_stock < 10 AND p.is_active = TRUE
      ORDER BY s.current_stock ASC
      LIMIT 5
    `);

    lowStockItems.forEach(item => {
      alerts.push({
        type: 'warning',
        category: 'stock',
        title: 'Stock faible',
        message: `${item.name} (${item.code}): ${item.current_stock} unités restantes`,
        priority: item.current_stock < 5 ? 'high' : 'medium',
        timestamp: new Date()
      });
    });

    if (isAdmin) {
      // Commandes en retard (admin/manager seulement)
      const overdueOrders = await executeQuery(`
        SELECT 
          o.order_number,
          c.company_name,
          DATEDIFF(NOW(), o.created_at) as days_overdue
        FROM orders o
        JOIN clients c ON o.client_id = c.id
        WHERE o.status IN ('draft', 'confirmed') 
          AND DATEDIFF(NOW(), o.created_at) > 7
        ORDER BY days_overdue DESC
        LIMIT 5
      `);

      overdueOrders.forEach(order => {
        alerts.push({
          type: 'error',
          category: 'orders',
          title: 'Commande en retard',
          message: `Commande ${order.order_number} pour ${order.company_name} en attente depuis ${order.days_overdue} jours`,
          priority: order.days_overdue > 14 ? 'high' : 'medium',
          timestamp: new Date()
        });
      });

      // Devis expirés
      const expiredQuotes = await executeQuery(`
        SELECT 
          q.quote_number,
          o.order_number,
          c.company_name,
          q.validity_date
        FROM quotes q
        JOIN orders o ON q.order_id = o.id
        JOIN clients c ON o.client_id = c.id
        WHERE q.status = 'pending' AND q.validity_date < CURDATE()
        ORDER BY q.validity_date ASC
        LIMIT 5
      `);

      expiredQuotes.forEach(quote => {
        alerts.push({
          type: 'warning',
          category: 'quotes',
          title: 'Devis expiré',
          message: `Devis ${quote.quote_number} pour ${quote.company_name} expiré le ${quote.validity_date}`,
          priority: 'medium',
          timestamp: new Date()
        });
      });
    }

    // Tri des alertes par priorité
    alerts.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    res.json({
      success: true,
      data: {
        alerts: alerts.slice(0, 10), // Limiter à 10 alertes
        totalCount: alerts.length,
        unreadCount: alerts.filter(alert => alert.priority === 'high').length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// GET /api/dashboard/recent-activity - Activité récente
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';
    const userId = req.user.id;

    let activities = [];

    if (isAdmin) {
      // Activités globales pour admin/manager
      const [reports, orders, stockMovements] = await Promise.all([
        executeQuery(`
          SELECT 
            'report' as type,
            dr.id,
            dr.report_date,
            dr.status,
            dr.created_at,
            u.first_name,
            u.last_name,
            u.username
          FROM daily_reports dr
          JOIN users u ON dr.user_id = u.id
          ORDER BY dr.created_at DESC
          LIMIT ?
        `, [Math.floor(limit / 3)]),

        executeQuery(`
          SELECT 
            'order' as type,
            o.id,
            o.order_number,
            o.status,
            o.created_at,
            c.company_name,
            u.first_name,
            u.last_name
          FROM orders o
          JOIN clients c ON o.client_id = c.id
          JOIN users u ON o.created_by = u.id
          ORDER BY o.created_at DESC
          LIMIT ?
        `, [Math.floor(limit / 3)]),

        executeQuery(`
          SELECT 
            'stock' as type,
            sm.id,
            sm.movement_type,
            sm.quantity,
            sm.created_at,
            p.code as product_code,
            p.name as product_name,
            u.first_name,
            u.last_name
          FROM pba_stock_movements sm
          JOIN pba_products p ON sm.pba_product_id = p.id
          JOIN users u ON sm.created_by = u.id
          ORDER BY sm.created_at DESC
          LIMIT ?
        `, [Math.floor(limit / 3)])
      ]);

      activities = [...reports, ...orders, ...stockMovements];
    } else {
      // Activités personnelles pour utilisateur normal
      const reports = await executeQuery(`
        SELECT 
          'report' as type,
          dr.id,
          dr.report_date,
          dr.status,
          dr.created_at,
          dr.first_name,
          dr.last_name
        FROM daily_reports dr
        WHERE dr.user_id = ?
        ORDER BY dr.created_at DESC
        LIMIT ?
      `, [userId, limit]);

      activities = reports;
    }

    // Tri par date de création
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: activities.slice(0, limit)
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité récente:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;
