FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código fuente
COPY . .

# Exponer puerto del servicio de negocio (alineado con docker-compose)
EXPOSE 3002

# Comando para desarrollo
CMD ["npm", "run", "dev"]