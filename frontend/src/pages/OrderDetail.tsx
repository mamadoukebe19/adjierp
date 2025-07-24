import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';

const OrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrder(data.data);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Chargement...</Typography>;
  if (!order) return <Typography>Commande non trouvée</Typography>;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/orders')}>
          Retour
        </Button>
        <Typography variant="h4" ml={2}>
          Commande {order.order?.order_number}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Informations Commande</Typography>
              <Typography><strong>N° Commande:</strong> {order.order?.order_number}</Typography>
              <Typography><strong>Date:</strong> {new Date(order.order?.order_date).toLocaleDateString('fr-FR')}</Typography>
              <Typography><strong>Statut:</strong> <Chip label={order.order?.status} size="small" /></Typography>
              <Typography><strong>Montant Total:</strong> {parseFloat(order.order?.total_amount || 0).toLocaleString()} DA</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Client</Typography>
              <Typography><strong>Entreprise:</strong> {order.order?.client_name}</Typography>
              <Typography><strong>Contact:</strong> {order.order?.contact_person}</Typography>
              <Typography><strong>Email:</strong> {order.order?.client_email}</Typography>
              <Typography><strong>Téléphone:</strong> {order.order?.client_phone}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Articles</Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell align="right">Quantité</TableCell>
                    <TableCell align="right">Prix Unitaire</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_code} - {item.product_name}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{parseFloat(item.unit_price).toLocaleString()} DA</TableCell>
                      <TableCell align="right">{parseFloat(item.total_price).toLocaleString()} DA</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrderDetail;