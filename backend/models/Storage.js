const mongoose = require('mongoose');

const storageSchema = new mongoose.Schema({
  boxNumber: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 500
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  occupiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  accessCode: {
    type: String,
    default: null
  },
  occupiedAt: {
    type: Date,
    default: null
  },

});

module.exports = mongoose.model('Storage', storageSchema);
