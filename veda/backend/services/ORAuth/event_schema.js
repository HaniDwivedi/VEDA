const mongoose = require('mongoose');

const DeviceSessionSchema = new mongoose.Schema({
  desktopDeviceId: String,
  desktopDeviceName: String,
  mobileDeviceId: String,
  mobileDeviceName: String,
  location: String,
  status: { type: String, default: 'ACTIVE' },
  connectedAt: { type: Date, default: Date.now },
  disconnectedAt: Date
});

module.exports = mongoose.model('DeviceSessionLog', DeviceSessionSchema);