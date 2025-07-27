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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Payment as PaymentIcon } from '@mui/icons-material';

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceData, setInvoiceData] = useState({
    dueDays: 30,
    notes: ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    notes: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchPaidOrders();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/invoices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaidOrders = async () => {
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
    }
  };

  const createInvoice = async () => {
    if (!selectedOrder) return;
    
    try {
      const response = await fetch(`/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          orderId: selectedOrder,
          ...invoiceData
        })
      });
      
      if (response.ok) {
        const event = new CustomEvent('showNotification', {
          detail: { message: 'Facture créée avec succès', type: 'success' }
        });
        window.dispatchEvent(event);
        setShowCreateDialog(false);
        setSelectedOrder('');
        setInvoiceData({ dueDays: 30, notes: '' });
        fetchInvoices();
      }
    } catch (error) {
      console.error('Erreur lors de la création de la facture:', error);
    }
  };

  const addPayment = async () => {
    if (!selectedInvoice) return;
    
    try {
      const response = await fetch(`/api/orders/${selectedInvoice.order_id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(paymentData)
      });
      
      if (response.ok) {
        setShowPaymentDialog(false);
        setSelectedInvoice(null);
        setPaymentData({
          amount: 0,
          paymentMethod: 'cash',
          paymentDate: new Date().toISOString().split('T')[0],
          reference: '',
          notes: ''
        });
        fetchInvoices();
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du paiement:', error);
    }
  };

  const downloadInvoicePDF = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${invoiceId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    }
  };

  const openPaymentDialog = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      ...paymentData,
      amount: invoice.total_amount - invoice.paid_amount
    });
    setShowPaymentDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'sent': return 'primary';
      case 'paid': return 'success';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Gestion des Factures
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateDialog(true)}
        >
          Nouvelle Facture
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>N° Facture</TableCell>
              <TableCell>N° Commande</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Échéance</TableCell>
              <TableCell align="right">Montant (DA)</TableCell>
              <TableCell align="right">Payé (DA)</TableCell>
              <TableCell align="right">Restant (DA)</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">Chargement...</TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">Aucune facture trouvée</TableCell>
              </TableRow>
            ) : invoices.map((invoice: any) => {
              const remaining = invoice.total_amount - invoice.paid_amount;
              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <strong>{invoice.invoice_number}</strong>
                  </TableCell>
                  <TableCell>{invoice.order_number}</TableCell>
                  <TableCell>{invoice.client_name}</TableCell>
                  <TableCell>{new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell align="right">
                    <strong>{parseFloat(invoice.total_amount || 0).toLocaleString()}</strong>
                  </TableCell>
                  <TableCell align="right" style={{ color: 'green' }}>
                    {parseFloat(invoice.paid_amount || 0).toLocaleString()}
                  </TableCell>
                  <TableCell align="right" style={{ color: remaining > 0 ? 'red' : 'green' }}>
                    {remaining.toLocaleString()}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={invoice.status}
                      color={getStatusColor(invoice.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" onClick={() => downloadInvoicePDF(invoice.id)}>
                      PDF
                    </Button>
                    {remaining > 0 && (
                      <Button 
                        size="small" 
                        color="primary" 
                        startIcon={<PaymentIcon />}
                        onClick={() => openPaymentDialog(invoice)}
                        sx={{ ml: 1 }}
                      >
                        Payer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Créer une Nouvelle Facture</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Commande"
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="">Sélectionner une commande</option>
                {orders.map((order: any) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number} - {order.client_name} ({parseFloat(order.total_amount).toLocaleString()} DA)
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Échéance (jours)"
                value={invoiceData.dueDays}
                onChange={(e) => setInvoiceData({...invoiceData, dueDays: parseInt(e.target.value) || 30})}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Annuler</Button>
          <Button onClick={createInvoice} variant="contained" disabled={!selectedOrder}>
            Créer la Facture
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onClose={() => setShowPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un Paiement</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Facture: {selectedInvoice?.invoice_number} - Montant restant: {selectedInvoice ? (selectedInvoice.total_amount - selectedInvoice.paid_amount).toLocaleString() : 0} DA
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Montant (DA)"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})}
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Méthode de paiement"
                value={paymentData.paymentMethod}
                onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
              >
                <MenuItem value="cash">Espèces</MenuItem>
                <MenuItem value="check">Chèque</MenuItem>
                <MenuItem value="transfer">Virement</MenuItem>
                <MenuItem value="card">Carte</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date de paiement"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({...paymentData, paymentDate: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Référence"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({...paymentData, reference: e.target.value})}
                placeholder="Numéro de chèque, référence virement, etc."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentDialog(false)}>Annuler</Button>
          <Button onClick={addPayment} variant="contained" disabled={paymentData.amount <= 0}>
            Enregistrer le Paiement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Invoices;