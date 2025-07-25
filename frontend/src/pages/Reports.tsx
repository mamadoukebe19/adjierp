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
  TextField,
  Grid,
  Card,
  CardContent,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    period: 'all',
    startDate: '',
    endDate: '',
    status: 'all'
  });

  useEffect(() => {
    if (filters.period === 'all' && !filters.startDate && !filters.endDate && filters.status === 'all') {
      fetchReports();
    }
  }, []);

  const fetchReports = async () => {
    try {
      let url = '/api/reports?';
      const params = new URLSearchParams();
      
      if (filters.period !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }
        
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', now.toISOString().split('T')[0]);
      }
      
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      
      url += params.toString();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReports(data.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des rapports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const downloadReportPDF = async (reportId: number) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${reportId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Rapports Journaliers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/reports/new')}
        >
          Nouveau Rapport
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              Filtres
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Période"
                value={filters.period}
                onChange={(e) => handleFilterChange('period', e.target.value)}
              >
                <MenuItem value="all">Toutes les périodes</MenuItem>
                <MenuItem value="today">Aujourd'hui</MenuItem>
                <MenuItem value="week">Cette semaine</MenuItem>
                <MenuItem value="month">Ce mois</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Date de début"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Date de fin"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Statut"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="all">Tous les statuts</MenuItem>
                <MenuItem value="draft">Brouillon</MenuItem>
                <MenuItem value="submitted">Soumis</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Auteur</TableCell>
              <TableCell>Total PBA</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Chargement...</TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Aucun rapport trouvé</TableCell>
              </TableRow>
            ) : (
              reports.map((report: any) => (
                <TableRow key={report.id}>
                  <TableCell>{new Date(report.report_date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{`${report.first_name} ${report.last_name}`}</TableCell>
                  <TableCell>{report.pbaTotal}</TableCell>
                  <TableCell>{report.status}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => navigate(`/reports/${report.id}`)}>Voir</Button>
                    <Button size="small" onClick={() => downloadReportPDF(report.id)} sx={{ ml: 1 }}>PDF</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Reports;
