# Stage 1: Build the application
FROM node:18-alpine as build

# Définition du répertoire de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Copie du code source
COPY . .

# Construction de l'application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copie de la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers buildés
COPY --from=build /app/dist /usr/share/nginx/html

# Exposition du port
EXPOSE 3000

# Commande de démarrage
CMD ["nginx", "-g", "daemon off;"]
