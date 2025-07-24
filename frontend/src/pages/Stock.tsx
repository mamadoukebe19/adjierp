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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';

const Stock: React.FC = () => {
  const [stockPBA, setStockPBA] = useState([]);
  const [stockMateriaux, setStockMateriaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState({
    quantity: 0,
    adjustmentType: 'add',
    notes: ''
  });

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

  const handleAdjustStock = (product: any) => {
    setSelectedProduct(product);
    setAdjustmentData({ quantity: 0, adjustmentType: 'add', notes: '' });
    setShowAdjustment(true);
  };

  const submitAdjustment = async () => {
    try {
      const response = await fetch('/api/stock/pba/manual-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          productId: (selectedProduct as any)?.pba_product_id,
          quantity: adjustmentData.quantity,
          adjustmentType: adjustmentData.adjustmentType,
          notes: adjustmentData.notes
        })
      });
      
      if (response.ok) {
        setShowAdjustment(false);
        fetchStock();
      }
    } catch (error) {
      console.error('Erreur:', error);
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
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">Chargement...</TableCell>
                      </TableRow>
                    ) : stockPBA.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">Aucun stock PBA trouvé</TableCell>
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
                          <TableCell align="center">
                            <Button size="small" onClick={() => handleAdjustStock(item)}>Ajuster</Button>
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
      
      <Dialog open={showAdjustment} onClose={() => setShowAdjustment(false)}>
        <DialogTitle>Ajuster Stock - {(selectedProduct as any)?.code}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Type d'ajustement"
                value={adjustmentData.adjustmentType}
                onChange={(e) => setAdjustmentData({...adjustmentData, adjustmentType: e.target.value})}
              >
                <MenuItem value="add">Entrée (+)</MenuItem>
                <MenuItem value="remove">Sortie (-)</MenuItem>
                <MenuItem value="set">Définir stock</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Quantité"
                value={adjustmentData.quantity}
                onChange={(e) => setAdjustmentData({...adjustmentData, quantity: parseInt(e.target.value) || 0})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={adjustmentData.notes}
                onChange={(e) => setAdjustmentData({...adjustmentData, notes: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAdjustment(false)}>Annuler</Button>
          <Button onClick={submitAdjustment} variant="contained">Ajuster</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stock;
