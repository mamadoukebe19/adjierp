import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,

} from '@mui/material';

const Stock: React.FC = () => {
  const stockPBA = [
    { type: '9AR150', initial: 100, production: 45, sorties: 30, actuel: 115, seuil: 50 },
    { type: '9AR300', initial: 80, production: 38, sorties: 25, actuel: 93, seuil: 40 },
    { type: '9AR400', initial: 120, production: 52, sorties: 40, actuel: 132, seuil: 60 },
    { type: '9AR650', initial: 60, production: 20, sorties: 15, actuel: 65, seuil: 30 },
  ];

  const stockMateriaux = [
    { materiau: 'Fer 6-20', unite: 'kg', stock: 2500, seuil: 1000 },
    { materiau: 'Étriers', unite: 'unités', stock: 850, seuil: 500 },
    { materiau: 'Ciment', unite: 'sacs', stock: 120, seuil: 200 },
  ];

  const getStockStatus = (actuel: number, seuil: number) => {
    if (actuel <= seuil) return { label: 'Critique', color: 'error' as const };
    if (actuel <= seuil * 1.5) return { label: 'Faible', color: 'warning' as const };
    return { label: 'Normal', color: 'success' as const };
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Gestion des Stocks
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stock PBA (Poteaux Béton Armé)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type PBA</TableCell>
                      <TableCell align="right">Stock Initial</TableCell>
                      <TableCell align="right">Production</TableCell>
                      <TableCell align="right">Sorties</TableCell>
                      <TableCell align="right">Stock Actuel</TableCell>
                      <TableCell align="center">Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockPBA.map((item) => {
                      const status = getStockStatus(item.actuel, item.seuil);
                      return (
                        <TableRow key={item.type}>
                          <TableCell component="th" scope="row">
                            <strong>{item.type}</strong>
                          </TableCell>
                          <TableCell align="right">{item.initial}</TableCell>
                          <TableCell align="right" style={{ color: 'green' }}>+{item.production}</TableCell>
                          <TableCell align="right" style={{ color: 'red' }}>-{item.sorties}</TableCell>
                          <TableCell align="right"><strong>{item.actuel}</strong></TableCell>
                          <TableCell align="center">
                            <Chip label={status.label} color={status.color} size="small" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stock Matériaux
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Matériau</TableCell>
                      <TableCell>Unité</TableCell>
                      <TableCell align="right">Stock Actuel</TableCell>
                      <TableCell align="right">Seuil d'Alerte</TableCell>
                      <TableCell align="center">Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockMateriaux.map((item) => {
                      const status = getStockStatus(item.stock, item.seuil);
                      return (
                        <TableRow key={item.materiau}>
                          <TableCell component="th" scope="row">
                            <strong>{item.materiau}</strong>
                          </TableCell>
                          <TableCell>{item.unite}</TableCell>
                          <TableCell align="right"><strong>{item.stock}</strong></TableCell>
                          <TableCell align="right">{item.seuil}</TableCell>
                          <TableCell align="center">
                            <Chip label={status.label} color={status.color} size="small" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Stock;
