import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,

} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ReportForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date: new Date().toISOString().split('T')[0],
    pba9AR150: 0,
    pba9AR300: 0,
    pba9AR400: 0,
    observations: '',
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Rapport soumis:', formData);
    // TODO: Implémenter l'envoi vers l'API
    navigate('/reports');
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/reports')}
          sx={{ mr: 2 }}
        >
          Retour
        </Button>
        <Typography variant="h4">
          Nouveau Rapport Journalier
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Informations Personnelles
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Nom"
                      value={formData.nom}
                      onChange={(e) => handleChange('nom', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Prénom"
                      value={formData.prenom}
                      onChange={(e) => handleChange('prenom', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleChange('date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Production PBA
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="9AR150"
                      type="number"
                      value={formData.pba9AR150}
                      onChange={(e) => handleChange('pba9AR150', parseInt(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="9AR300"
                      type="number"
                      value={formData.pba9AR300}
                      onChange={(e) => handleChange('pba9AR300', parseInt(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="9AR400"
                      type="number"
                      value={formData.pba9AR400}
                      onChange={(e) => handleChange('pba9AR400', parseInt(e.target.value) || 0)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Observations
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Commentaires et observations"
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/reports')}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
              >
                Enregistrer
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default ReportForm;
