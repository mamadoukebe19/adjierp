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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Reports: React.FC = () => {
  const navigate = useNavigate();

  const mockReports = [
    { id: 1, date: '2024-01-15', author: 'Jean Dupont', pbaTotal: 45, status: 'Validé' },
    { id: 2, date: '2024-01-14', author: 'Marie Martin', pbaTotal: 38, status: 'En attente' },
    { id: 3, date: '2024-01-13', author: 'Pierre Durand', pbaTotal: 52, status: 'Validé' },
  ];

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
            {mockReports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{report.date}</TableCell>
                <TableCell>{report.author}</TableCell>
                <TableCell>{report.pbaTotal}</TableCell>
                <TableCell>{report.status}</TableCell>
                <TableCell>
                  <Button size="small">Voir</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Reports;
