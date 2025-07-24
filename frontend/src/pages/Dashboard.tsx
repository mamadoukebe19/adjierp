import React from 'react';
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
  const stats = [
    {
      title: 'Rapports Journaliers',
      value: '12',
      icon: <ReportsIcon sx={{ fontSize: 40, color: '#1976d2' }} />,
      color: '#e3f2fd',
    },
    {
      title: 'Stock PBA',
      value: '1,250',
      icon: <StockIcon sx={{ fontSize: 40, color: '#388e3c' }} />,
      color: '#e8f5e8',
    },
    {
      title: 'Clients Actifs',
      value: '45',
      icon: <ClientsIcon sx={{ fontSize: 40, color: '#f57c00' }} />,
      color: '#fff3e0',
    },
    {
      title: 'Commandes',
      value: '28',
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
        {stats.map((stat, index) => (
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
