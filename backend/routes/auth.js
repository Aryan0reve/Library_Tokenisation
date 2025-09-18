const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, libraryAuth } = require('../middleware/auth');

const router = express.Router();

// Student Registration (NO TOKEN EXPIRATION)
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }

    // Create new user
    const user = new User({ 
      email: email.toLowerCase(), 
      password 
    });
    await user.save();

    // Generate JWT token WITHOUT EXPIRATION
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
      // Removed: { expiresIn: '24h' } - Token never expires
    );

    console.log(`New user registered: ${user.email}`);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { 
        id: user._id, 
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: messages 
      });
    }

    res.status(500).json({ 
      message: 'Server error during registration', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Student Login (NO TOKEN EXPIRATION)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Find user by email (case insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token WITHOUT EXPIRATION
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
      // Removed: { expiresIn: '24h' } - Token never expires
    );

    console.log(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Library Login (NO TOKEN EXPIRATION)
router.post('/library-login', libraryAuth, (req, res) => {
  try {
    // Generate JWT token WITHOUT EXPIRATION
    const token = jwt.sign(
      { role: 'library' },
      process.env.JWT_SECRET
      // Removed: { expiresIn: '24h' } - Token never expires
    );

    console.log('Library user logged in successfully');

    res.json({
      message: 'Library login successful',
      token,
      role: 'library',
      loginTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Library login error:', error);
    res.status(500).json({ 
      message: 'Server error during library login', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify token endpoint (for checking if token is still valid)
router.get('/verify-token', auth, (req, res) => {
  try {
    if (req.user.role === 'library') {
      return res.json({
        valid: true,
        role: 'library',
        user: { role: 'library' }
      });
    }

    res.json({
      valid: true,
      role: 'student',
      user: {
        id: req.user._id,
        email: req.user.email,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      message: 'Server error during token verification' 
    });
  }
});

// Change password endpoint for students
router.put('/change-password', auth, async (req, res) => {
  try {
    // Only allow students to change password, not library
    if (req.user.role === 'library') {
      return res.status(403).json({ 
        message: 'Library users cannot change password through this endpoint' 
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`Password changed for user: ${user.email}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Server error during password change' 
    });
  }
});

// Logout endpoint (mainly for cleanup, since tokens don't expire)
router.post('/logout', auth, (req, res) => {
  try {
    // Since tokens don't expire, this is mainly for client-side cleanup
    // In a production app, you might want to maintain a blacklist of tokens
    
    const userInfo = req.user.role === 'library' 
      ? 'Library user' 
      : req.user.email;
    
    console.log(`User logged out: ${userInfo}`);

    res.json({ 
      message: 'Logout successful',
      note: 'Please clear your local storage and tokens on the client side'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      message: 'Server error during logout' 
    });
  }
});

// Get user profile (students only)
router.get('/profile', auth, (req, res) => {
  try {
    if (req.user.role === 'library') {
      return res.status(403).json({ 
        message: 'Profile not available for library users' 
      });
    }

    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        createdAt: req.user.createdAt,
        isVerified: req.user.isVerified
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      message: 'Server error fetching profile' 
    });
  }
});

module.exports = router;
