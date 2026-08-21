# Cryptographic Payslip Sealing & Public Verification Portal

This directory implements the backend logic for cryptographic document verification to prevent forged or altered PDF payslips.

## Design Architecture

1. **Document Hashing**:
   - The PDF document is hashed using SHA-256 during generation.
   - The document hash is immutable and unique to the specific payslip content.

2. **Digital Signatures**:
   - The server computes a signature of the SHA-256 hash using HMAC-SHA256 with the tenant salt key.
   - This ensures third parties cannot forge a record or edit the metadata fields without invalidating the seal.

3. **Public API Endpoint**:
   - A public route `POST /api/public/verification/verify` accepts the SHA-256 hash.
   - It responds with the verified properties of the original document: original employee name, tenant name, document type, and creation date.

## Security Considerations
- The secret key `CRYPTO_SEAL_SECRET` should be set to a high-entropy string in production.
- Client-side hashing is recommended in frontend portals so the raw file content is never transmitted across the network, preserving user privacy.

## Verification Pipeline Details

```
+--------------------+
|  Generated Payslip |
+---------+----------+
          |
          v
+---------+----------+
|  Compute SHA-256   |
+---------+----------+
          |
          v
+---------+----------+
| HMAC-SHA256 Sign  |
+---------+----------+
          |
          v
+---------+----------+
| Store DocumentSeal |
+--------------------+
```

The validation flow checks the hash against the database. If there is any character mismatch in the hash, it fails validation immediately.

## Verification Flow Details
1. Drag and drop file to client-side.
2. Read file as binary stream buffer.
3. Compute SHA-256 hash using Web Crypto API.
4. Send JSON request:
   ```json
   {
     "hash": "a1b2c3d4..."
   }
   ```
5. Server queries the DocumentSeal collection.
6. Server regenerates HMAC signature matching the hash.
7. Return true/false valid indicators.
8. Render verification details on public portal.