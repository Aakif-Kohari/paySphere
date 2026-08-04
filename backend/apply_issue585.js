const fs = require('fs');
const path = require('path');

// 1. Create Tenant model
const tenantModelPath = path.join(__dirname, 'src', 'models', 'tenant.model.js');
const tenantModelCode = `const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', tenantSchema);
`;
fs.writeFileSync(tenantModelPath, tenantModelCode);

// 2. Add tenantId to all other models
const modelsDir = path.join(__dirname, 'src', 'models');
const models = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js') && f !== 'tenant.model.js' && f !== 'role.model.js' && f !== 'permission.model.js' && f !== 'cronlock.model.js');

for (const model of models) {
  const filePath = path.join(modelsDir, model);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add tenantId field if not present
  if (!content.includes('tenantId: {') && content.includes('createdBy: {')) {
    content = content.replace(
      /createdBy:\s*\{[^}]+\},/g,
      match => `${match}\n    tenantId: {\n      type: mongoose.Schema.Types.ObjectId,\n      ref: 'Tenant',\n      required: true,\n    },`
    );
  } else if (!content.includes('tenantId: {') && model === 'user.model.js') {
    // For User model
    content = content.replace(
      /role:\s*\{[^}]+\},/g,
      match => `${match}\n  tenantId: {\n    type: mongoose.Schema.Types.ObjectId,\n    ref: 'Tenant',\n  },`
    );
  }

  // Update indexes in employee.model.js
  if (model === 'employee.model.js' && content.includes('createdBy: 1')) {
    content = content.replace(/createdBy: 1/g, 'tenantId: 1');
  }

  fs.writeFileSync(filePath, content);
}

// 3. Update Auth Controller (register, login)
const authControllerPath = path.join(__dirname, 'src', 'controllers', 'user.controller.js');
if (fs.existsSync(authControllerPath)) {
  let authContent = fs.readFileSync(authControllerPath, 'utf8');
  
  if (!authContent.includes("const Tenant = require('../models/tenant.model');")) {
    authContent = "const Tenant = require('../models/tenant.model');\n" + authContent;
  }
  
  // Update register logic to create Tenant
  if (authContent.includes('const user = new User(')) {
    authContent = authContent.replace(
      /const user = new User\(\{([\s\S]*?)\}\);/g,
      `const tenant = new Tenant({ name: companyName });\n    await tenant.save();\n\n    const user = new User({$1, tenantId: tenant._id });`
    );
  }

  // Update token payload
  if (authContent.includes('id: user._id,')) {
    authContent = authContent.replace(
      /id: user\._id,(\s*role: user\.role,)?/g,
      `id: user._id,\n      role: user.role,\n      tenantId: user.tenantId,`
    );
  }

  fs.writeFileSync(authControllerPath, authContent);
}

// 4. Update auth.middleware.js
const authMiddlewarePath = path.join(__dirname, 'src', 'middlewares', 'auth.middleware.js');
if (fs.existsSync(authMiddlewarePath)) {
  let authMidContent = fs.readFileSync(authMiddlewarePath, 'utf8');
  authMidContent = authMidContent.replace(/req\.userId = decoded\.id;/g, 'req.userId = decoded.id;\n    req.tenantId = decoded.tenantId;');
  fs.writeFileSync(authMiddlewarePath, authMidContent);
}

// 5. Update all controllers to use req.tenantId instead of req.userId for querying/creation
const controllersDir = path.join(__dirname, 'src', 'controllers');
const controllers = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js') && f !== 'user.controller.js' && f !== 'employeePortal.controller.js');

for (const controller of controllers) {
  const filePath = path.join(controllersDir, controller);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace { createdBy: req.userId } with { tenantId: req.tenantId }
  content = content.replace(/\{([^}]*)createdBy:\s*req\.userId([^}]*)\}/g, (match, p1, p2) => {
    return `{${p1}tenantId: req.tenantId${p2}}`;
  });

  // Replace createdBy: req.userId in object assignments (e.g. creations)
  content = content.replace(/createdBy:\s*req\.userId/g, 'createdBy: req.userId, tenantId: req.tenantId');

  // Ensure any Model.find({ createdBy: req.userId }) without spaces is caught
  content = content.replace(/createdBy:req\.userId/g, 'tenantId: req.tenantId');

  fs.writeFileSync(filePath, content);
}

console.log('Multi-tenant architecture applied successfully.');
