import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Avatar,
} from '@mui/material';
import { Add as AddIcon, Business as BusinessIcon } from '@mui/icons-material';
import ClientForm from '../components/ClientForm';

const Clients: React.FC = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleEditClient = (client: any) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleSaveClient = async (clientData: any) => {
    try {
      const url = editingClient ? `/api/clients/${(editingClient as any).id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(clientData)
      });
      
      if (response.ok) {
        setShowForm(false);
        setEditingClient(null);
        fetchClients();
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du client:', error);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Gestion des Clients
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddClient}
        >
          Nouveau Client
        </Button>
      </Box>

      {loading ? (
        <Typography>Chargement...</Typography>
      ) : (
        <Grid container spacing={3}>
          {clients.length === 0 ? (
            <Grid item xs={12}>
              <Typography align="center">Aucun client trouvé</Typography>
            </Grid>
          ) : (clients as any[]).map((client: any) => (
          <Grid item xs={12} md={6} lg={4} key={client.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: '#1976d2', mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {client.companyName || client.company_name}
                    </Typography>
                    <Chip
                      label={client.is_active ? 'Actif' : 'Inactif'}
                      color={client.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Contact:</strong> {client.contactPerson || client.contact_person || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Téléphone:</strong> {client.phone || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Email:</strong> {client.email || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Adresse:</strong> {client.address || 'N/A'}
                </Typography>
                
                <Box mt={2} display="flex" gap={1}>
                  <Button size="small" variant="outlined" onClick={() => handleEditClient(client)}>
                    Modifier
                  </Button>
                  <Button size="small" variant="outlined">
                    Commandes
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          ))}
        </Grid>
      )}
      
      <ClientForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSaveClient}
        client={editingClient}
      />
    </Box>
  );
};

export default Clients;
