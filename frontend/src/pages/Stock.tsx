import React, { useState, useEffect } from 'react';
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
  const [stockPBA, setStockPBA] = useState([]);
  const [stockMateriaux, setStockMateriaux] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      const [pbaResponse, materialResponse] = await Promise.all([
        fetch('/api/stock/pba', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/stock/materials', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        })
      ]);
      
      if (pbaResponse.ok) {
        const pbaData = await pbaResponse.json();
        setStockPBA(pbaData.data || []);
      }
      
      if (materialResponse.ok) {
        const materialData = await materialResponse.json();
        setStockMateriaux(materialData.data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des stocks:', error);
    } finally {
      setLoading(false);
    }
  };

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
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">Chargement...</TableCell>
                      </TableRow>
                    ) : stockPBA.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">Aucun stock PBA trouvé</TableCell>
                      </TableRow>
                    ) : stockPBA.map((item: any) => {
                      const status = getStockStatus(item.currentStock || 0, 50);
                      return (
                        <TableRow key={item.code || item.id}>
                          <TableCell component="th" scope="row">
                            <strong>{item.code}</strong>
                          </TableCell>
                          <TableCell align="right">{item.initialStock || 0}</TableCell>
                          <TableCell align="right" style={{ color: 'green' }}>+{item.totalProduced || 0}</TableCell>
                          <TableCell align="right" style={{ color: 'red' }}>-{item.totalDelivered || 0}</TableCell>
                          <TableCell align="right"><strong>{item.currentStock || 0}</strong></TableCell>
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
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">Chargement...</TableCell>
                      </TableRow>
                    ) : stockMateriaux.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">Aucun stock matériau trouvé</TableCell>
                      </TableRow>
                    ) : stockMateriaux.map((item: any) => {
                      const status = getStockStatus(item.currentStock || 0, 100);
                      return (
                        <TableRow key={item.name || item.id}>
                          <TableCell component="th" scope="row">
                            <strong>{item.name}</strong>
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell align="right"><strong>{item.currentStock || 0}</strong></TableCell>
                          <TableCell align="right">{100}</TableCell>
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
