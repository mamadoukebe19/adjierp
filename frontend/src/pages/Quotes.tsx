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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const Quotes: React.FC = () => {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [quoteData, setQuoteData] = useState({
    validityDays: 30,
    totalAmount: 0,
    notes: ''
  });

  useEffect(() => {
    fetchQuotes();
    fetchActiveClients();
  }, []);

  const fetchQuotes = async () => {
    try {
      const response = await fetch('/api/quotes', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuotes(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des devis:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveClients = async () => {
    try {
      const response = await fetch('/api/clients?status=active', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    }
  };

  const createQuote = async () => {
    if (!selectedClient) return;
    
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          clientId: selectedClient,
          ...quoteData
        })
      });
      
      if (response.ok) {
        const event = new CustomEvent('showNotification', {
          detail: { message: 'Devis créé avec succès', type: 'success' }
        });
        window.dispatchEvent(event);
        setShowCreateDialog(false);
        setSelectedClient('');
        setQuoteData({ validityDays: 30, totalAmount: 0, notes: '' });
        fetchQuotes();
      }
    } catch (error) {
      console.error('Erreur lors de la création du devis:', error);
    }
  };

  const acceptQuote = async (orderId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/quote/accept`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        fetchQuotes();
      }
    } catch (error) {
      console.error('Erreur lors de l\'acceptation du devis:', error);
    }
  };

  const downloadQuotePDF = async (quoteId: number) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devis-${quoteId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'rejected': return 'error';
      case 'expired': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Gestion des Devis
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateDialog(true)}
        >
          Nouveau Devis
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>N° Devis</TableCell>
              <TableCell>N° Commande</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Validité</TableCell>
              <TableCell align="right">Montant (DA)</TableCell>
              <TableCell align="center">Statut</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Chargement...</TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Aucun devis trouvé</TableCell>
              </TableRow>
            ) : quotes.map((quote: any) => (
              <TableRow key={quote.id}>
                <TableCell>
                  <strong>{quote.quote_number}</strong>
                </TableCell>
                <TableCell>{quote.order_number}</TableCell>
                <TableCell>{quote.client_name}</TableCell>
                <TableCell>{new Date(quote.quote_date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>{new Date(quote.validity_date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell align="right">
                  <strong>{parseFloat(quote.total_amount || 0).toLocaleString()} DA</strong>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={quote.status}
                    color={getStatusColor(quote.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Button size="small" onClick={() => downloadQuotePDF(quote.id)}>
                    PDF
                  </Button>
                  {quote.status === 'pending' && (
                    <Button 
                      size="small" 
                      color="success" 
                      onClick={() => acceptQuote(quote.order_id)}
                      sx={{ ml: 1 }}
                    >
                      Accepter
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Créer un Nouveau Devis</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Client"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="">Sélectionner un client</option>
                {clients.map((client: any) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name} - {client.contact_person}
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Montant (DA)"
                value={quoteData.totalAmount}
                onChange={(e) => setQuoteData({...quoteData, totalAmount: parseFloat(e.target.value) || 0})}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Validité (jours)"
                value={quoteData.validityDays}
                onChange={(e) => setQuoteData({...quoteData, validityDays: parseInt(e.target.value) || 30})}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={quoteData.notes}
                onChange={(e) => setQuoteData({...quoteData, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Annuler</Button>
          <Button onClick={createQuote} variant="contained" disabled={!selectedClient || quoteData.totalAmount <= 0}>
            Créer le Devis
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Quotes;