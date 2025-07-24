import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const Orders: React.FC = () => {
  const mockOrders = [
    {
      id: 'CMD-001',
      client: 'Entreprise BTP Alger',
      date: '2024-01-15',
      montant: 125000,
      statut: 'En cours',
      items: '50x 9AR150, 30x 9AR300',
    },
    {
      id: 'CMD-002',
      client: 'Construction Moderne',
      date: '2024-01-12',
      montant: 89500,
      statut: 'Validée',
      items: '40x 9AR400, 20x 12AR400',
    },
    {
      id: 'CMD-003',
      client: 'Bâtiment Plus',
      date: '2024-01-10',
      montant: 156000,
      statut: 'Livrée',
      items: '60x 9AR650, 25x 12AR650',
    },
    {
      id: 'CMD-004',
      client: 'Entreprise BTP Alger',
      date: '2024-01-08',
      montant: 78000,
      statut: 'En attente',
      items: '35x 9AR300, 15x 9AR400',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'En cours': return 'primary';
      case 'Validée': return 'success';
      case 'Livrée': return 'info';
      case 'En attente': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Gestion des Commandes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
        >
          Nouvelle Commande
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>N° Commande</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Articles</TableCell>
              <TableCell align="right">Montant (DA)</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <strong>{order.id}</strong>
                </TableCell>
                <TableCell>{order.client}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {order.items}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <strong>{order.montant.toLocaleString()} DA</strong>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={order.statut}
                    color={getStatusColor(order.statut) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Button size="small" variant="outlined">
                    Détails
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Orders;
