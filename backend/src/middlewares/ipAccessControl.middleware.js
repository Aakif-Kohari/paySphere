'use strict';
const IpWhitelist = require('../models/ipWhitelist.model');
const logger = require('../utils/logger');

function ipMatchesCidr(ip, cidr) {
  if (cidr.includes('/')) {
    const [range, bits] = cidr.split('/');
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    const mask = ~( (1 << (32 - Number(bits))) - 1 );
    const ipVal = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeVal = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
    return (ipVal & mask) === (rangeVal & mask);
  }
  return ip === cidr;
}

async function ipAccessControl(req, res, next) {
  try {
    if (!req.tenantId || !req.userRole) return next();

    const whitelist = await IpWhitelist.findOne({
      tenantId: req.tenantId,
      role: req.userRole,
    });

    if (!whitelist || !whitelist.cidrBlocks || whitelist.cidrBlocks.length === 0) {
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    const checkIp = clientIp === '::1' || clientIp === '::ffff:127.0.0.1' ? '127.0.0.1' : clientIp;

    let isAllowed = false;
    for (const cidr of whitelist.cidrBlocks) {
      if (ipMatchesCidr(checkIp, cidr)) {
        isAllowed = true;
        break;
      }
    }

    if (!isAllowed) {
      logger.warn('Access denied: IP not whitelisted', {
        tenantId: req.tenantId,
        role: req.userRole,
        clientIp,
      });
      return res.status(403).json({ message: 'Access denied: Your IP address is not whitelisted for this role.' });
    }

    next();
  } catch (err) {
    logger.error('IP access control middleware error', { error: err.message });
    next();
  }
}

module.exports = ipAccessControl;