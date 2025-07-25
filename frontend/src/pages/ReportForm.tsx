import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  IconButton,
  Divider,
  MenuItem,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ReportForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState<{
    nom: string;
    prenom: string;
    date: string;
    pba: Record<string, number>;
    materials: Array<{ name: string; quantity: number; unit: string }>;
    additionalBars: Array<{ name: string; quantity: number; unit: string }>;
    armatures: Array<{ id: number; code: string; name: string; quantity: number }>;
    personnel: Record<string, number>;
    observations: string;
  }>({
    nom: '',
    prenom: '',
    date: new Date().toISOString().split('T')[0],
    // PBA Production
    pba: {
      '9AR150': 0, '9AR300': 0, '9AR400': 0, '9AR650': 0,
      '12AR400': 0, '12AR650': 0, '12B1000': 0, '12B1250': 0,
      '12B1600': 0, '12B2000': 0, '10B2000': 0
    },
    // Materials
    materials: [
      { name: 'Fer6-20', quantity: 0, unit: 'kg' },
      { name: 'Étriers', quantity: 0, unit: 'kg' },
      { name: 'Ciment', quantity: 0, unit: 'sac' }
    ],
    additionalBars: [],
    // Armatures
    armatures: [],
    // Personnel
    personnel: {
      production: 0,
      soudeur: 0,
      ferrailleur: 0,
      ouvrier: 0,
      macon: 0,
      manoeuvre: 0
    },
    observations: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, materialsRes, armaturesRes] = await Promise.all([
        fetch('/api/reports/data/products', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/reports/data/materials', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }),
        fetch('/api/reports/data/armatures', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        })
      ]);
      
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || []);
      }
      if (materialsRes.ok) {
        const data = await materialsRes.json();
        setMaterials(data.data || []);
      }
      if (armaturesRes.ok) {
        const data = await armaturesRes.json();
        setFormData(prev => ({
          ...prev,
          armatures: data.data.map((arm: any) => ({ id: arm.id, code: arm.code, name: arm.name, quantity: 0 }))
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePBAChange = (code: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      pba: { ...prev.pba, [code]: value }
    }));
  };

  const handleMaterialChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.map((mat, i) => 
        i === index ? { ...mat, [field]: value } : mat
      )
    }));
  };

  const addBar = () => {
    setFormData(prev => ({
      ...prev,
      additionalBars: [...prev.additionalBars, { name: '', quantity: 0, unit: 'barre' }]
    }));
  };

  const removeBar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalBars: prev.additionalBars.filter((_, i) => i !== index)
    }));
  };

  const handleBarChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      additionalBars: prev.additionalBars.map((bar, i) => 
        i === index ? { ...bar, [field]: value } : bar
      )
    }));
  };

  const handleArmatureChange = (index: number, value: number) => {
    setFormData(prev => ({
      ...prev,
      armatures: prev.armatures.map((arm, i) => 
        i === index ? { ...arm, quantity: value } : arm
      )
    }));
  };

  const handlePersonnelChange = (position: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      personnel: { ...prev.personnel, [position]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Prepare PBA production data
      const pbaProduction = Object.entries(formData.pba)
        .filter(([_, quantity]) => quantity > 0)
        .map(([code, quantity]) => {
          const product = products.find((p: any) => p.code === code);
          return product ? { productId: (product as any).id, quantity } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Prepare materials data
      const materialUsage = [...formData.materials, ...formData.additionalBars]
        .filter(mat => mat.quantity > 0)
        .map(mat => {
          const material = materials.find((m: any) => m.name === mat.name || m.code === mat.name);
          return material ? {
            materialId: (material as any).id,
            quantity: mat.quantity,
            unit: mat.unit
          } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Prepare armatures data
      const armatureProduction = formData.armatures
        .filter(arm => arm.quantity > 0)
        .map(arm => ({
          armatureId: arm.id,
          quantity: arm.quantity
        }));

      // Prepare personnel data
      const personnel = Object.entries(formData.personnel)
        .filter(([_, quantity]) => quantity > 0)
        .map(([position, quantity]) => ({ position, quantity }));

      const response = await fetch('/api/reports/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          reportDate: formData.date,
          firstName: formData.nom,
          lastName: formData.prenom,
          pbaProduction,
          materialUsage,
          armatureProduction,
          personnel,
          observations: formData.observations
        })
      });
      
      if (response.ok) {
        navigate('/reports');
      } else {
        console.error('Erreur lors de la création du rapport');
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
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

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Production PBA
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(formData.pba).map(([code, quantity]) => (
                    <Grid item xs={6} md={3} key={code}>
                      <TextField
                        fullWidth
                        label={code}
                        type="number"
                        value={quantity}
                        onChange={(e) => handlePBAChange(code, parseInt(e.target.value) || 0)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Matériaux Utilisés
                </Typography>
                <Grid container spacing={2}>
                  {formData.materials.map((material, index) => (
                    <Grid item xs={12} md={4} key={index}>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label={material.name}
                            type="number"
                            value={material.quantity}
                            onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0, step: 0.1 }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            select
                            label="Unité"
                            value={material.unit}
                            onChange={(e) => handleMaterialChange(index, 'unit', e.target.value)}
                          >
                            <MenuItem value="kg">kg</MenuItem>
                            <MenuItem value="t">t</MenuItem>
                            <MenuItem value="sac">sac</MenuItem>
                            <MenuItem value="barre">barre</MenuItem>
                          </TextField>
                        </Grid>
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">Barres Supplémentaires</Typography>
                  <Button startIcon={<AddIcon />} onClick={addBar} size="small">
                    Ajouter une barre
                  </Button>
                </Box>
                
                {formData.additionalBars.map((bar, index) => (
                  <Grid container spacing={2} key={index} sx={{ mb: 1 }}>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        label="Nom de la barre"
                        value={bar.name}
                        onChange={(e) => handleBarChange(index, 'name', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        fullWidth
                        label="Quantité"
                        type="number"
                        value={bar.quantity}
                        onChange={(e) => handleBarChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        inputProps={{ min: 0, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        fullWidth
                        select
                        label="Unité"
                        value={bar.unit}
                        onChange={(e) => handleBarChange(index, 'unit', e.target.value)}
                      >
                        <MenuItem value="barre">barre</MenuItem>
                        <MenuItem value="kg">kg</MenuItem>
                        <MenuItem value="t">t</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={2}>
                      <IconButton onClick={() => removeBar(index)} color="error">
                        <RemoveIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Armatures Façonnées
                </Typography>
                <Grid container spacing={2}>
                  {formData.armatures.map((armature, index) => (
                    <Grid item xs={12} key={index}>
                      <TextField
                        fullWidth
                        label={`${armature.code} - ${armature.name}`}
                        type="number"
                        value={armature.quantity}
                        onChange={(e) => handleArmatureChange(index, parseInt(e.target.value) || 0)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Personnel Mobilisé
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(formData.personnel).map(([position, quantity]) => (
                    <Grid item xs={6} key={position}>
                      <TextField
                        fullWidth
                        label={position.charAt(0).toUpperCase() + position.slice(1)}
                        type="number"
                        value={quantity}
                        onChange={(e) => handlePersonnelChange(position, parseInt(e.target.value) || 0)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Observations et Commentaires
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Commentaires et observations"
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  placeholder="Décrivez les événements particuliers, problèmes rencontrés, améliorations suggérées..."
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
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default ReportForm;
