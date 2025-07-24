import React from 'react';
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

const Clients: React.FC = () => {
  const mockClients = [
    {
      id: 1,
      nom: 'Entreprise BTP Alger',
      contact: 'Ahmed Benali',
      telephone: '+213 21 123 456',
      email: 'contact@btp-alger.dz',
      adresse: 'Zone industrielle, Alger',
      statut: 'Actif',
      derniereCommande: '2024-01-10',
    },
    {
      id: 2,
      nom: 'Construction Moderne',
      contact: 'Fatima Khelil',
      telephone: '+213 31 789 012',
      email: 'f.khelil@construction-moderne.dz',
      adresse: 'Oran Centre',
      statut: 'Actif',
      derniereCommande: '2024-01-08',
    },
    {
      id: 3,
      nom: 'Bâtiment Plus',
      contact: 'Mohamed Saidi',
      telephone: '+213 25 345 678',
      email: 'contact@batiment-plus.dz',
      adresse: 'Constantine',
      statut: 'Inactif',
      derniereCommande: '2023-12-15',
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Gestion des Clients
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
        >
          Nouveau Client
        </Button>
      </Box>

      <Grid container spacing={3}>
        {mockClients.map((client) => (
          <Grid item xs={12} md={6} lg={4} key={client.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar sx={{ bgcolor: '#1976d2', mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {client.nom}
                    </Typography>
                    <Chip
                      label={client.statut}
                      color={client.statut === 'Actif' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Contact:</strong> {client.contact}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Téléphone:</strong> {client.telephone}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Email:</strong> {client.email}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Adresse:</strong> {client.adresse}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Dernière commande:</strong> {client.derniereCommande}
                </Typography>
                
                <Box mt={2} display="flex" gap={1}>
                  <Button size="small" variant="outlined">
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
    </Box>
  );
};

export default Clients;
