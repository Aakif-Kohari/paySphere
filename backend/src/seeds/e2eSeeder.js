require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const logger = require('../utils/logger');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const Role = require('../models/role.model');
const { seedRbac } = require('./rbac.seed');

const seedE2EUser = async () => {
  try {
    await connectDB();
    await seedRbac();
    const ownerRole = await Role.findOne({ name: 'SuperAdmin' });
    if (!ownerRole) {
      throw new Error('SuperAdmin role not found after RBAC seeding');
    }

    const testEmail = (
      process.env.TEST_USER_EMAIL || 'test@example.com'
    ).toLowerCase();
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword';

    let user = await User.findOne({ email: testEmail });
    if (!user) {
      const hashedPassword = await bcrypt.hash(testPassword, 12);

      // Setup Tenant first
      let tenant = new Tenant({
        name: 'PaySphere Test Tenant',
        domain: 'paysphere-test.com',
      });
      await tenant.save();
      logger.info('Test Tenant created');

      user = new User({
        fullName: 'Test E2E User',
        email: testEmail,
        companyName: 'PaySphere Test Tenant',
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        accountType: 'ADMIN',
        role: ownerRole._id,
        tenantId: tenant._id,
        isEmailVerified: true,
      });
      await user.save();
      logger.info(`Test user ${testEmail} created successfully.`);

      tenant.ownerId = user._id;
      await tenant.save();
    } else {
      logger.info(`Test user ${testEmail} already exists.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('E2E database seeding failed', { error: error.message });
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedE2EUser();
