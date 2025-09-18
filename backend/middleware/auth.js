const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware for students and library
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        message: 'Access denied. No authorization header provided.' 
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
    }

    console.log('Verifying token:', token.substring(0, 20) + '...');

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);
    
    // Check if it's a library token
    if (decoded.role === 'library') {
      req.user = { 
        role: 'library',
        id: 'library',
        isLibrary: true 
      };
      console.log('Library user authenticated');
      return next();
    }
    
    // For student tokens, get user from database
    if (decoded.id) {
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          message: 'Access denied. User not found.' 
        });
      }

      // Add user to request object
      req.user = user;
      console.log('Student user authenticated:', user.email);
      return next();
    }

    // If neither library nor valid student token
    return res.status(401).json({ 
      message: 'Access denied. Invalid token format.' 
    });

  } catch (error) {
    console.error('Authentication error:', error.message);
    
    // Handle different JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Access denied. Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Access denied. Token expired.' 
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        message: 'Access denied. Token not active.' 
      });
    }

    // Generic server error
    return res.status(500).json({ 
      message: 'Server error during authentication.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Library-specific authentication middleware (for login)
const libraryAuth = (req, res, next) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        message: 'Password is required' 
      });
    }
    
    if (password !== process.env.LIBRARY_PASSWORD) {
      console.log('Invalid library password attempt');
      return res.status(401).json({ 
        message: 'Invalid library password' 
      });
    }
    
    console.log('Library authentication successful');
    next();
  } catch (error) {
    console.error('Library auth error:', error);
    return res.status(500).json({ 
      message: 'Server error during library authentication' 
    });
  }
};

// Middleware to ensure only students can access certain routes
const studentOnly = (req, res, next) => {
  if (!req.user || req.user.role === 'library') {
    return res.status(403).json({ 
      message: 'Access denied. Students only.' 
    });
  }
  next();
};

// Middleware to ensure only library can access certain routes
const libraryOnly = (req, res, next) => {
  if (!req.user || !req.user.isLibrary) {
    return res.status(403).json({ 
      message: 'Access denied. Library access only.' 
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role === 'library') {
      req.user = { 
        role: 'library',
        id: 'library',
        isLibrary: true 
      };
    } else if (decoded.id) {
      const user = await User.findById(decoded.id).select('-password');
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

// Middleware to validate JWT secret is set
const validateJWTConfig = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    return res.status(500).json({ 
      message: 'Server configuration error' 
    });
  }
  next();
};

// Rate limiting middleware for authentication attempts
const authRateLimit = {};
const AUTH_ATTEMPTS_LIMIT = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const rateLimitAuth = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // Clean up old entries
  if (authRateLimit[clientIP]) {
    authRateLimit[clientIP] = authRateLimit[clientIP].filter(
      timestamp => now - timestamp < AUTH_WINDOW_MS
    );
  } else {
    authRateLimit[clientIP] = [];
  }
  
  // Check if limit exceeded
  if (authRateLimit[clientIP].length >= AUTH_ATTEMPTS_LIMIT) {
    return res.status(429).json({
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil(AUTH_WINDOW_MS / 1000)
    });
  }
  
  // Add current attempt
  authRateLimit[clientIP].push(now);
  next();
};

module.exports = {
  auth,
  libraryAuth,
  studentOnly,
  libraryOnly,
  optionalAuth,
  validateJWTConfig,
  rateLimitAuth
};
