# Role-Based IP Whitelisting & Session Fingerprinting

This folder contains components that secure PaySphere against session hijacking and unauthorized network access.

## Features

1. **Session Fingerprinting (`sessionFingerprint.middleware.js`)**:
   - Calculates a SHA-256 hash using request headers (User-Agent, Accept-Language, Accept).
   - On the first request, caches the fingerprint in Redis.
   - Blocks subsequent requests if the calculated fingerprint does not match the cached value.

2. **IP Access Control (`ipAccessControl.middleware.js`)**:
   - Compares the incoming request IP against role-based CIDR ranges.
   - Enforces subnet check (VPN/office-only gating) for critical roles like `ADMIN` and `FINANCE`.

## Custom CIDR Range Checker

Due to standard CommonJS dependency constraints, we implement a pure-Javascript CIDR checker.

```javascript
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
```

## Security Best Practices
- Keep your VPN CIDR configuration updated.
- Audit active session fingerprints periodically to spot anomalies.