const express = require('express');
const Request = require('../models/Request');
const Storage = require('../models/Storage');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Request storage
router.post('/request-storage', auth, async (req, res) => {
  try {
    // Check if user already has pending request
    const existingRequest = await Request.findOne({
      studentId: req.user._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending request' });
    }

    // Check if user already has active storage
    const activeStorage = await Storage.findOne({
      occupiedBy: req.user._id,
      isOccupied: true
    });

    if (activeStorage) {
      return res.status(400).json({ message: 'You already have an active storage' });
    }

    const request = new Request({
      studentId: req.user._id,
      studentEmail: req.user.email
    });

    await request.save();
    req.io.emit('new-request', request);

    res.status(201).json({
      message: 'Storage request submitted successfully',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get student's current storage
router.get('/my-storage', auth, async (req, res) => {
  try {
    const storage = await Storage.findOne({
      occupiedBy: req.user._id,
      isOccupied: true
    });

    const pendingRequest = await Request.findOne({
      studentId: req.user._id,
      status: 'pending'
    });

    res.json({
      storage,
      pendingRequest: !!pendingRequest
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
