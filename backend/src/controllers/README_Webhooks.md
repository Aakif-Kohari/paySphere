# Developer Portal Webhooks Setup & Delivery Retries

This directory houses the webhook endpoints enabling developers to configure HTTP integrations for employee and payroll updates.

## Features

1. **HMAC-SHA256 Payload Signing**:
   - Every POST payload carries a signature in `X-PaySphere-Signature`.
   - The signature is generated using the endpoint's unique hex secret.

2. **Delivery Status Logs**:
   - Inspect delivery status logs (`webhookDelivery.model.js`) showing request/response bodies, status code, and latency.
   - Automatically retried up to 5 times with exponential backoff on connection drops or HTTP errors.

3. **Manual Retries & Testing**:
   - Manually trigger redelivery of failed messages from the Dead Letter Queue (DLQ).
   - Test endpoints by enqueuing a mock `TEST_EVENT` payload directly.

## Webhook Verification Signature Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(secret, payloadString, incomingSignature) {
  const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  return signature === incomingSignature;
}
```

Make sure to rotate secrets annually for high-security environments.

## API Usage Reference

### 1. Register Webhook
- **Endpoint**: `POST /api/webhooks`
- **Payload**:
  ```json
  {
    "url": "https://example.com/callback",
    "description": "Primary webhook for payroll sync",
    "subscribedEvents": ["PAYROLL_FINALIZE", "PAYROLL_PAID"]
  }
  ```
- **Response**:
  ```json
  {
    "_id": "60d0fe4f5311236168a109a1",
    "url": "https://example.com/callback",
    "secret": "9a0fbc...",
    "subscribedEvents": ["PAYROLL_FINALIZE", "PAYROLL_PAID"]
  }
  ```

### 2. Trigger Test Event
- **Endpoint**: `POST /api/webhooks/:id/test`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Test webhook enqueued successfully."
  }
  ```
  This immediately delivers a test payload matching the format of standard events.