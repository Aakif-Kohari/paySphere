const {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
} = require('../services/apiKey.service');

exports.generateKey = async (req, res, next) => {
  try {
    const { name, scopes } = req.body;
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (!name) {
      return res
        .status(400)
        .json({ error: 'Name is required for the API Key' });
    }

    const { apiKey, rawKey } = await generateApiKey(
      tenantId,
      userId,
      name,
      scopes,
    );

    // Send back the rawKey ONLY once
    res.status(201).json({
      apiKey,
      rawKey,
    });
  } catch (err) {
    next(err);
  }
};

exports.listKeys = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const keys = await listApiKeys(tenantId);
    res.json(keys);
  } catch (err) {
    next(err);
  }
};

exports.revokeKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const revoked = await revokeApiKey(id, tenantId);
    if (!revoked) {
      return res
        .status(404)
        .json({ error: 'API Key not found or already revoked' });
    }

    res.json({ message: 'API Key revoked successfully' });
  } catch (err) {
    next(err);
  }
};
