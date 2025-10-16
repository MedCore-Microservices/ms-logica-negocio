const axios = require('axios');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    // Llamar al MS-AUTH para verificar el token
    const authResponse = await axios.get('http://localhost:3001/api/auth/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Si llegamos aquí, el token es válido
    req.user = authResponse.data.user;
    next();

  } catch (error) {
    return res.status(401).json({ 
      message: 'Token inválido o expirado',
      error: error.response?.data?.message || error.message 
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'No tienes permisos para esta acción',
        requiredRoles: roles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

module.exports = { authenticate, requireRole };