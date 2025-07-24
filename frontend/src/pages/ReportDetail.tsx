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
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';

const ReportDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/reports/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReport(data.data);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Typography>Chargement...</Typography>;
  if (!report) return <Typography>Rapport non trouvé</Typography>;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/reports')}>
          Retour
        </Button>
        <Typography variant="h4" ml={2}>
          Rapport du {new Date(report.report_date).toLocaleDateString('fr-FR')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Informations</Typography>
              <Typography><strong>Auteur:</strong> {report.first_name} {report.last_name}</Typography>
              <Typography><strong>Date:</strong> {new Date(report.report_date).toLocaleDateString('fr-FR')}</Typography>
              <Typography><strong>Statut:</strong> <Chip label={report.status} size="small" /></Typography>
              <Typography><strong>Total PBA:</strong> {report.pbaTotal || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Observations</Typography>
              <Typography>{report.observations || 'Aucune observation'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportDetail;