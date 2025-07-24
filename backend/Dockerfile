# Utilisation de l'image officielle Node.js
FROM node:18-alpine

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install --only=production

# Copie du code source
COPY . .

# Création d'un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Changement de propriétaire du répertoire de travail
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exposition du port
EXPOSE 5000

# Commande de démarrage
CMD ["npm", "start"]
