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
  Tabs,
  Tab,
} from '@mui/material';

const Stock: React.FC = () => {
  const [stockPBA, setStockPBA] = useState([]);
  const [stockMateriaux, setStockMateriaux] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showMaterialAdjustment, setShowMaterialAdjustment] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState({
    period: 'all',
    startDate: '',
    endDate: '',
    movementType: 'all',
    productId: 'all'
  });
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

  const fetchMovements = async () => {
    try {
      let url = '/api/stock/movements/pba?';
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
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.movementType !== 'all') params.append('movementType', filters.movementType);
      if (filters.productId !== 'all') params.append('productId', filters.productId);
      
      url += params.toString();
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMovements(data.data?.movements || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mouvements:', error);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (tabValue === 2) {
      fetchMovements();
    }
  }, [filters, tabValue]);

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

  const handleAdjustMaterial = (material: any) => {
    setSelectedMaterial(material);
    setAdjustmentData({ quantity: 0, adjustmentType: 'add', notes: '' });
    setShowMaterialAdjustment(true);
  };

  const submitMaterialAdjustment = async () => {
    try {
      const response = await fetch('/api/stock/materials/manual-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          materialId: (selectedMaterial as any)?.material_id,
          quantity: adjustmentData.quantity,
          adjustmentType: adjustmentData.adjustmentType,
          notes: adjustmentData.notes
        })
      });
      
      if (response.ok) {
        setShowMaterialAdjustment(false);
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Stock PBA" />
          <Tab label="Stock Matériaux" />
          <Tab label="Mouvements de Stock" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
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

      </Grid>
      )}

      {tabValue === 1 && (
      <Grid container spacing={3}>
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
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">Chargement...</TableCell>
                      </TableRow>
                    ) : stockMateriaux.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">Aucun stock matériau trouvé</TableCell>
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
                          <TableCell align="center">
                            <Button size="small" onClick={() => handleAdjustMaterial(item)}>Ajuster</Button>
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
      )}

      {tabValue === 2 && (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Filtres des Mouvements
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    select
                    label="Période"
                    value={filters.period}
                    onChange={(e) => handleFilterChange('period', e.target.value)}
                  >
                    <MenuItem value="all">Toutes</MenuItem>
                    <MenuItem value="today">Aujourd'hui</MenuItem>
                    <MenuItem value="week">Cette semaine</MenuItem>
                    <MenuItem value="month">Ce mois</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date début"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date fin"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    select
                    label="Type"
                    value={filters.movementType}
                    onChange={(e) => handleFilterChange('movementType', e.target.value)}
                  >
                    <MenuItem value="all">Tous</MenuItem>
                    <MenuItem value="production">Production</MenuItem>
                    <MenuItem value="delivery">Livraison</MenuItem>
                    <MenuItem value="adjustment">Ajustement</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    label="Produit"
                    value={filters.productId}
                    onChange={(e) => handleFilterChange('productId', e.target.value)}
                  >
                    <MenuItem value="all">Tous les produits</MenuItem>
                    {stockPBA.map((item: any) => (
                      <MenuItem key={item.pba_product_id} value={item.pba_product_id}>
                        {item.code} - {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Historique des Mouvements
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                      <TableCell>Référence</TableCell>
                      <TableCell>Utilisateur</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">Aucun mouvement trouvé</TableCell>
                      </TableRow>
                    ) : movements.map((movement: any) => (
                      <TableRow key={movement.id}>
                        <TableCell>{new Date(movement.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{movement.product_code}</TableCell>
                        <TableCell>
                          <Chip 
                            label={movement.movement_type} 
                            color={movement.movement_type === 'production' ? 'success' : 
                                   movement.movement_type === 'delivery' ? 'error' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right" style={{ 
                          color: movement.quantity > 0 ? 'green' : 'red' 
                        }}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </TableCell>
                        <TableCell>{movement.reference_type}</TableCell>
                        <TableCell>{movement.created_by_username}</TableCell>
                        <TableCell>{movement.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}
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
      
      <Dialog open={showMaterialAdjustment} onClose={() => setShowMaterialAdjustment(false)}>
        <DialogTitle>Ajuster Stock Matériau - {(selectedMaterial as any)?.name}</DialogTitle>
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
          <Button onClick={() => setShowMaterialAdjustment(false)}>Annuler</Button>
          <Button onClick={submitMaterialAdjustment} variant="contained">Ajuster</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stock;
