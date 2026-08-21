const crypto = require('crypto');
const { BiometricDevice } = require('../models/biometric.model');

/**
 * Biometric webhook receiver middleware that verifies payload integrity via HMAC-SHA256 signature.
 */
async function verifyBiometricPayload(req, res, next) {
  try {
    const signature = req.headers['x-biometric-signature'];
    if (!signature) {
      return res.status(401).json({ message: 'Missing biometric signature' });
    }

    const { deviceSerial } = req.body;
    if (!deviceSerial) {
      return res.status(400).json({ message: 'Missing device serial number' });
    }

    const device = await BiometricDevice.findOne({ deviceSerial });
    if (!device) {
      return res.status(404).json({ message: 'Device not registered' });
    }

    const secret = device.secretKey || 'biometric-device-secret-key';
    
    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(req.body));
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ message: 'Invalid biometric signature. Payload compromised.' });
    }

    // Attach device context to request
    req.device = device;
    req.tenantId = device.tenantId; // Ensure correct tenant scoping is passed along
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  verifyBiometricPayload
};
