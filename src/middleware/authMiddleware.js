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
    const user = authResponse.data.user || {};
    // Normalizar rol para evitar desajustes (e.g., "doctor" -> "MEDICO", acentos, etc.)
    const normalize = (v) =>
      String(v || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quitar acentos
        .trim();

    let role = normalize(user.role);
    if (role === 'DOCTOR') role = 'MEDICO';
    if (role === 'ADMIN') role = 'ADMINISTRADOR';

    req.user = { ...user, role };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[authMiddleware] user authenticated:', { id: req.user.id, role: req.user.role });
    }
    next();

  } catch (error) {
    return res.status(401).json({ 
      message: 'Token inválido o expirado',
      error: error.response?.data?.message || error.message 
    });
  }
};

// Middleware para verificar roles específicos (tolerante a formato)
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const normalize = (v) =>
      String(v || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const rolesNormalized = roles.map(normalize).map((r) => (r === 'DOCTOR' ? 'MEDICO' : r === 'ADMIN' ? 'ADMINISTRADOR' : r));
    let userRole = normalize(req.user.role);
    if (userRole === 'DOCTOR') userRole = 'MEDICO';
    if (userRole === 'ADMIN') userRole = 'ADMINISTRADOR';

    if (process.env.NODE_ENV !== 'production') {
      console.log('[requireRole] check', { userRole, rolesNormalized });
    }

    if (!rolesNormalized.includes(userRole)) {
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