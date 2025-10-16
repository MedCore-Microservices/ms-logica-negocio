const express = require('express');
const diagnosticRoutes = require('./routes/diagnosticRoutes');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/diagnostics', diagnosticRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'ms-business',
    timestamp: new Date().toISOString()
  });
});

// Ruta para probar conexión a BD
app.get('/test-db', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      take: 5,
      select: { id: true, email: true, role: true }
    });
    
    res.json({
      success: true,
      message: 'Conexión a BD exitosa',
      users: users
    });
  } catch (error) {
    console.error('Error BD:', error);
    res.status(500).json({
      success: false,
      message: 'Error conectando a BD',
      error: error.message
    });
  }
});

// Manejo de errores global (CORREGIDO - sin referencia a multer)
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  
  // Manejar errores de Multer si existen
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Archivo demasiado grande'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Business Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🗄️  Test DB: http://localhost:${PORT}/test-db`);
});