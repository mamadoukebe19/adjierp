import React, { useState, useEffect } from 'react';
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
import { useNavigate } from 'react-router-dom';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadOrderPDF = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commande-${orderId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    }
  };

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
          onClick={() => navigate('/orders/new')}
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Chargement...</TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">Aucune commande trouvée</TableCell>
              </TableRow>
            ) : orders.map((order: any) => (
              <TableRow key={order.id}>
                <TableCell>
                  <strong>{order.orderNumber || order.order_number}</strong>
                </TableCell>
                <TableCell>{order.client_name || 'Client inconnu'}</TableCell>
                <TableCell>{new Date(order.order_date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {order.itemsCount || 0} articles
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <strong>{parseFloat(order.total_amount || 0).toLocaleString()} DA</strong>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={order.status}
                    color={getStatusColor(order.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Button size="small" variant="outlined" onClick={() => navigate(`/orders/${order.id}`)}>
                    Détails
                  </Button>
                  <Button size="small" onClick={() => downloadOrderPDF(order.id)} sx={{ ml: 1 }}>
                    PDF
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
