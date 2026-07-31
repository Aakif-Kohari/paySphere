/**
 * Standalone RBAC seeder — `npm run seed` from backend/.
 *
 * The server also seeds on boot, so this is only needed to re-seed after
 * editing config/permissions.js, or to repair a database by hand.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { seedRbac } = require("./rbac.seed");
const logger = require("../utils/logger");

const run = async () => {
  await connectDB();

  const result = await seedRbac();

  if (!result.seeded) {
    logger.error("Seeding failed", { error: result.error });
    await mongoose.disconnect();
    process.exit(1);
  }

  logger.info("Seeding finished", {
    permissions: result.permissions,
    roles: result.roles,
    usersBackfilled: result.usersBackfilled,
  });

  await mongoose.disconnect();
  process.exit(0);
};

run();
