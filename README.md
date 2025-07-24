# ERP DOCC - Application de Gestion de Production

Application web ERP complète dockerisée pour l'entreprise DOCC spécialisée dans la fabrication de poteaux en béton armé (PBA).

## 🏗️ Architecture

### Services
- **Frontend** : React + TypeScript + Material-UI (Port 3000)
- **Backend** : Node.js + Express + MySQL (Port 5000)
- **Base de données** : MySQL 8.0 (Port 3306)

### Structure du projet
```
docc-erp/
├── docker-compose.yml          # Orchestration des services
├── database/
│   └── init.sql               # Schéma et données initiales
├── backend/
│   ├── server.js              # Serveur API
│   ├── config/database.js     # Configuration DB
│   ├── middleware/auth.js     # Authentification
│   └── routes/                # API endpoints
└── frontend/
    ├── src/
    │   ├── types/            # Types TypeScript
    │   ├── services/api.ts   # Service API
    │   └── App.tsx          # Application principale
    └── nginx.conf           # Configuration Nginx
```

## 🚀 Démarrage

### Prérequis
- Docker et Docker Compose installés
- Ports 3000, 5000, 3306 disponibles

### Installation
```bash
# Cloner le projet
git clone <repository-url>
cd docc-erp

# Démarrer tous les services
docker-compose up -d --build

# Vérifier les services
docker-compose ps

# Voir les logs
docker-compose logs -f
```

### Accès aux services
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:5001
- **Base de données** : localhost:3306

### Utilisateur par défaut
- **Username** : admin
- **Password** : admin123

## 📋 Fonctionnalités

### ✅ Gestion des Rapports Journaliers
- Formulaire complet avec tous les champs spécifiés
- Informations personnelles (Nom, Prénom, Date)
- Quantités PBA produites (9AR150, 9AR300, 9AR400, 9AR650, 12AR400, 12AR650, 12B1000, 12B1250, 12B1600, 12B2000, 10B2000)
- Matériaux utilisés (Fer6-20, étriers, ciment) avec possibilité d'ajouter des barres
- Armatures façonnées
- Personnel mobilisé (production, soudeur, ferrailleur, ouvrier, maçon, manœuvre)
- Observations et commentaires
- Prévisualisation au format demandé
- Exclusion des valeurs nulles
- Mise à jour automatique des stocks

### ✅ Gestion des Stocks
- Calcul automatique : Stock actuel = Stock initial + Production - Sorties
- Suivi temps réel des PBA, armatures, matériaux
- Interaction avec les quantités des rapports
- Alertes de stock faible
- Historique des mouvements
- Ajustements manuels (admin)

### ✅ Workflow Commandes
- Commande → Validation → Devis → Paiement → Facture
- Génération automatique des numéros
- Gestion des statuts et transitions
- Suivi des paiements partiels/complets
- Génération de PDF

### ✅ Gestion des Clients
- Informations complètes (entreprise, contact, adresse)
- Recherche et filtrage
- Historique des commandes
- Statut actif/inactif

### ✅ Dashboard Administrateur
- Vue d'ensemble globale temps réel
- Statistiques de production
- Alertes et notifications
- Graphiques d'évolution mensuelle
- Produits les plus produits
- Commandes en attente
- Utilisateurs actifs

## 🔧 Configuration

### Variables d'environnement
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:5000/api

# Backend (automatique)
DB_HOST=database
DB_USER=docc_user
DB_PASSWORD=docc_password
DB_NAME=docc_erp
JWT_SECRET=your-jwt-secret
```

### Base de données
- 18 tables interconnectées
- Relations avec contraintes de clé étrangère
- Données initiales pré-chargées
- Triggers pour l'historique

## 🛠️ Développement

### Commandes utiles
```bash
# Reconstruire les services
docker-compose up -d --build

# Voir les logs d'un service
docker-compose logs -f [service_name]

# Arrêter les services
docker-compose down

# Nettoyer les volumes
docker-compose down -v

# Entrer dans un conteneur
docker-compose exec [service_name] sh
```

### API Endpoints
- `POST /api/auth/login` - Connexion
- `GET /api/reports` - Liste des rapports
- `POST /api/reports` - Créer un rapport
- `GET /api/stock/pba` - Stock PBA
- `GET /api/clients` - Liste des clients
- `GET /api/orders` - Liste des commandes
- `GET /api/dashboard/overview` - Vue d'ensemble
- `GET /api/users` - Gestion des utilisateurs

### Rôles utilisateur
- **admin** : Accès complet
- **manager** : Gestion + consultation
- **production** : Rapports + consultation
- **user** : Consultation seulement

## 🔒 Sécurité

- Authentification JWT avec refresh tokens
- Hashage des mots de passe (bcrypt)
- Middleware de sécurité (helmet, CORS, rate limiting)
- Validation des données (Joi)
- Gestion des permissions par rôle

## 📊 Spécifications Techniques

### Backend
- Node.js 18
- Express.js
- MySQL 8.0
- JWT pour l'authentification
- Middleware de sécurité

### Frontend
- React 18
- TypeScript
- Material-UI
- React Query pour la gestion d'état
- Vite pour le build

### Déploiement
- Docker multi-stage builds
- Nginx pour le reverse proxy
- Volumes persistants pour les données
- Configuration de production optimisée

## 🐛 Dépannage

### Problèmes courants
1. **Port déjà utilisé** : Arrêter les services qui utilisent les ports 3000, 5000, 3306
2. **Erreur de connexion DB** : Vérifier que le conteneur database est démarré
3. **Erreur de build** : Nettoyer les images Docker et reconstruire

### Logs de debug
```bash
# Voir tous les logs
docker-compose logs

# Logs spécifiques
docker-compose logs database
docker-compose logs backend
docker-compose logs frontend
```

## 📈 Évolutions futures

- Interface mobile responsive
- Notifications push
- Intégration avec systèmes externes
- Rapports avancés et analytics
- Gestion des stocks automatisée
- API REST complète

## 🤝 Support

Pour tout problème ou question, vérifier :
1. Les logs des conteneurs
2. La configuration des ports
3. Les variables d'environnement
4. L'état des services Docker
