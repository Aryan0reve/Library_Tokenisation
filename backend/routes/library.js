const express = require('express');
const Request = require('../models/Request');
const Storage = require('../models/Storage');

const router = express.Router();

// Generate random 6-digit code
const generateAccessCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get all storage boxes (no auth required for library dashboard)
router.get('/storage-boxes', async (req, res) => {
  try {
    let storages = await Storage.find({}).populate('occupiedBy', 'email');
    
    // Initialize boxes 1-500 if they don't exist
    if (storages.length === 0) {
      const boxes = [];
      for (let i = 1; i <= 500; i++) {
        boxes.push({ boxNumber: i });
      }
      await Storage.insertMany(boxes);
      storages = await Storage.find({}).populate('occupiedBy', 'email');
    }

    console.log(`Retrieved ${storages.length} storage boxes`);
    res.json(storages);
  } catch (error) {
    console.error('Storage boxes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending requests (no auth required for library dashboard)
router.get('/pending-requests', async (req, res) => {
  try {
    const requests = await Request.find({ status: 'pending' })
      .populate('studentId', 'email')
      .sort({ createdAt: -1 });
    
    console.log(`Retrieved ${requests.length} pending requests`);
    res.json(requests);
  } catch (error) {
    console.error('Pending requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign storage to student (NO TIME LIMIT)
router.post('/assign-storage', async (req, res) => {
  try {
    const { requestId, boxNumber } = req.body;

    console.log(`Assigning storage - Request ID: ${requestId}, Box: ${boxNumber}`);

    // Validate input
    if (!requestId || !boxNumber) {
      return res.status(400).json({ message: 'Request ID and box number are required' });
    }

    // Find and validate request
    const request = await Request.findById(requestId).populate('studentId');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Find and validate storage box
    const storage = await Storage.findOne({ boxNumber });
    if (!storage) {
      return res.status(404).json({ message: 'Storage box not found' });
    }

    if (storage.isOccupied) {
      return res.status(400).json({ message: 'Storage box is already occupied' });
    }

    // Generate unique access code
    let accessCode;
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (codeExists && attempts < maxAttempts) {
      accessCode = generateAccessCode();
      const existingStorage = await Storage.findOne({ accessCode });
      codeExists = !!existingStorage;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(500).json({ message: 'Failed to generate unique access code' });
    }

    // Update storage - NO EXPIRATION TIME
    storage.isOccupied = true;
    storage.occupiedBy = request.studentId._id;
    storage.accessCode = accessCode;
    storage.occupiedAt = new Date();
    // Removed: storage.expiresAt (no time limit)
    await storage.save();

    // Update request
    request.status = 'approved';
    request.assignedBox = boxNumber;
    request.accessCode = accessCode;
    request.processedAt = new Date();
    await request.save();

    console.log(`Storage assigned successfully - Box ${boxNumber} to ${request.studentEmail}`);

    // Emit socket events for real-time updates
    if (req.io) {
      req.io.emit('storage-assigned', {
        studentId: request.studentId._id,
        boxNumber,
        accessCode,
        occupiedAt: storage.occupiedAt
        // Removed: expiresAt (no expiration)
      });

      req.io.emit('storage-updated', storage);
    }

    res.json({
      message: 'Storage assigned successfully',
      boxNumber,
      studentEmail: request.studentEmail,
      accessCode: accessCode // Include in response for confirmation
    });
  } catch (error) {
    console.error('Assign storage error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Release storage
router.post('/release-storage', async (req, res) => {
  try {
    const { boxNumber, accessCode } = req.body;

    console.log(`Release storage attempt - Box: ${boxNumber}, Code: ${accessCode}`);

    // Validate input
    if (!boxNumber || !accessCode) {
      return res.status(400).json({ message: 'Box number and access code are required' });
    }

    // Find storage box
    const storage = await Storage.findOne({ boxNumber }).populate('occupiedBy', 'email');
    if (!storage) {
      return res.status(404).json({ message: 'Storage box not found' });
    }

    if (!storage.isOccupied) {
      return res.status(400).json({ message: 'Storage box is not currently occupied' });
    }

    // Verify access code
    if (storage.accessCode !== accessCode) {
      console.log(`Invalid access code attempt for box ${boxNumber}`);
      return res.status(400).json({ message: 'Invalid access code' });
    }

    const studentId = storage.occupiedBy._id;
    const studentEmail = storage.occupiedBy.email;

    // Release storage - clear all occupied data
    storage.isOccupied = false;
    storage.occupiedBy = null;
    storage.accessCode = null;
    storage.occupiedAt = null;
    // Note: expiresAt field was already removed from schema
    await storage.save();

    console.log(`Storage released successfully - Box ${boxNumber} from ${studentEmail}`);

    // Emit socket events for real-time updates
    if (req.io) {
      req.io.emit('storage-released', {
        studentId,
        boxNumber
      });

      req.io.emit('storage-updated', storage);
    }

    res.json({
      message: 'Storage released successfully',
      boxNumber,
      studentEmail
    });
  } catch (error) {
    console.error('Release storage error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get storage statistics (optional endpoint for dashboard)
router.get('/statistics', async (req, res) => {
  try {
    const totalBoxes = await Storage.countDocuments();
    const occupiedBoxes = await Storage.countDocuments({ isOccupied: true });
    const availableBoxes = totalBoxes - occupiedBoxes;
    const pendingRequests = await Request.countDocuments({ status: 'pending' });

    res.json({
      totalBoxes,
      occupiedBoxes,
      availableBoxes,
      pendingRequests
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get occupied boxes with details (for library management)
router.get('/occupied-boxes', async (req, res) => {
  try {
    const occupiedStorages = await Storage.find({ isOccupied: true })
      .populate('occupiedBy', 'email')
      .sort({ occupiedAt: -1 });

    res.json(occupiedStorages);
  } catch (error) {
    console.error('Occupied boxes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
