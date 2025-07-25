import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
} from '@mui/material';
import {
  Assignment as ReportsIcon,
  Inventory as StockIcon,
  People as ClientsIcon,
  ShoppingCart as OrdersIcon,
} from '@mui/icons-material';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    reports: 0,
    stock: 0,
    clients: 0,
    orders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [reportsRes, stockRes, clientsRes, ordersRes] = await Promise.all([
        fetch('/api/reports', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }),
        fetch('/api/stock/pba', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }),
        fetch('/api/clients', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } }),
        fetch('/api/orders', { headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } })
      ]);

      const [reports, stock, clients, orders] = await Promise.all([
        reportsRes.ok ? reportsRes.json() : { data: [] },
        stockRes.ok ? stockRes.json() : { data: [] },
        clientsRes.ok ? clientsRes.json() : { data: [] },
        ordersRes.ok ? ordersRes.json() : { data: [] }
      ]);

      setStats({
        reports: reports.data?.length || 0,
        stock: stock.data?.reduce((sum: number, item: any) => sum + (item.currentStock || 0), 0) || 0,
        clients: clients.data?.filter((c: any) => c.is_active).length || 0,
        orders: orders.data?.length || 0
      });
    } catch (error) {
      console.error('Erreur dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = [
    {
      title: 'Rapports Journaliers',
      value: loading ? '...' : stats.reports.toString(),
      icon: <ReportsIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      color: '#e3f2fd',
    },
    {
      title: 'Stock PBA Total',
      value: loading ? '...' : stats.stock.toLocaleString(),
      icon: <StockIcon sx={{ fontSize: 40, color: '#388e3c' }} />,
      color: '#e8f5e8',
    },
    {
      title: 'Clients Actifs',
      value: loading ? '...' : stats.clients.toString(),
      icon: <ClientsIcon sx={{ fontSize: 40, color: '#f57c00' }} />,
      color: '#fff3e0',
    },
    {
      title: 'Commandes',
      value: loading ? '...' : stats.orders.toString(),
      icon: <OrdersIcon sx={{ fontSize: 40, color: '#7b1fa2' }} />,
      color: '#f3e5f5',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard - Vue d'ensemble
      </Typography>
      
      <Grid container spacing={3}>
        {dashboardStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <Box
                    sx={{
                      backgroundColor: stat.color,
                      borderRadius: '50%',
                      p: 1,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h5">
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Production Récente
            </Typography>
            <Typography color="textSecondary">
              Graphique de production des derniers jours (à implémenter)
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Alertes Stock
            </Typography>
            <Typography color="textSecondary">
              • Stock PBA 9AR150: Niveau bas<br />
              • Ciment: Réapprovisionnement nécessaire
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
