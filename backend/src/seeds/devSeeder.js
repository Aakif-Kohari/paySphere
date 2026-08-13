require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const logger = require("../utils/logger");
const User = require("../models/user.model");
const Tenant = require("../models/tenant.model");
const Role = require("../models/role.model");
const Employee = require("../models/employee.model");
const PayrollUpdate = require("../models/payroll.model");
const { seedRbac } = require("./rbac.seed");

// Dynamically load faker, or fallback gracefully to prevent crashes
let faker;
try {
  faker = require("@faker-js/faker").faker;
} catch (e) {
  const firstNames = ["Amit", "Neha", "Rahul", "Priya", "Vikram", "Sneha", "Karan", "Anjali", "Rohan", "Pooja", "Arjun", "Aditi"];
  const lastNames = ["Sharma", "Patel", "Verma", "Mehra", "Gupta", "Singh", "Joshi", "Das", "Rao", "Nair", "Buha", "Desai"];
  const roles = ["Software Engineer", "Lead Architect", "HR Associate", "Senior Director", "Sales Account Executive", "Product Designer", "Legal Specialist", "Customer Support Analyst"];
  const bankNames = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Chase Bank", "Wells Fargo Bank"];
  
  faker = {
    person: {
      firstName: () => firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: () => lastNames[Math.floor(Math.random() * lastNames.length)],
      fullName: () => {
        const f = firstNames[Math.floor(Math.random() * firstNames.length)];
        const l = lastNames[Math.floor(Math.random() * lastNames.length)];
        return `${f} ${l}`;
      },
      jobTitle: () => roles[Math.floor(Math.random() * roles.length)],
    },
    internet: {
      email: ({ firstName, lastName } = {}) => {
        const fn = firstName || "employee";
        const ln = lastName || "domain";
        return `${fn.toLowerCase()}.${ln.toLowerCase()}.${Math.floor(Math.random() * 10000)}@paysphere-dev.com`;
      }
    },
    company: {
      name: () => "PaySphere Development Services",
    },
    finance: {
      accountNumber: (len = 12) => Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join(""),
      routingNumber: () => "SBIN000" + Math.floor(1000 + Math.random() * 9000),
    },
    date: {
      past: () => new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      between: ({ from, to }) => new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime())),
    }
  };
}

const DEPARTMENTS = [
  "Engineering",
  "Product Management",
  "Human Resources",
  "Sales & Marketing",
  "Finance",
  "Operations",
  "Customer Support",
  "Legal"
];

const seedDevDatabase = async () => {
  try {
    // 1. Ensure Roles are seeded
    await seedRbac();
    const ownerRole = await Role.findOne({ name: "Owner" });
    if (!ownerRole) {
      throw new Error("Owner role not found after RBAC seeding");
    }

    // 2. Setup Dev Admin User
    const adminEmail = "dev-admin@paysphere.com";
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashedPassword = await bcrypt.hash("Password123!", 12);
      admin = new User({
        fullName: "Dev Administrator",
        email: adminEmail,
        companyName: "PaySphere Dev Tenant",
        password: hashedPassword,
        passwordHistory: [hashedPassword],
        accountType: "ADMIN",
        role: ownerRole._id,
      });
      await admin.save();
      logger.info("Dev Admin user created");
    }

    // 3. Setup Dev Tenant
    let tenant = await Tenant.findOne({ ownerId: admin._id });
    if (!tenant) {
      tenant = new Tenant({
        name: "PaySphere Dev Tenant",
        ownerId: admin._id,
        domain: "paysphere-dev.com",
      });
      await tenant.save();
      logger.info("Dev Tenant created");
    }

    // Update user link to tenant
    if (!admin.tenantId || String(admin.tenantId) !== String(tenant._id)) {
      admin.tenantId = tenant._id;
      await admin.save();
    }

    // 4. Generate 520 realistic employees (500+ requirement)
    logger.info("Generating employees...");
    
    // Clear existing development employees to prevent conflicts
    await Employee.deleteMany({ tenantId: tenant._id });
    await PayrollUpdate.deleteMany({ tenantId: tenant._id });

    const employeesToInsert = [];
    const generatedEmails = new Set();
    const count = 520;

    for (let i = 1; i <= count; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const fullName = `${firstName} ${lastName}`;
      
      let email = faker.internet.email({ firstName, lastName });
      while (generatedEmails.has(email)) {
        email = faker.internet.email({ firstName, lastName });
      }
      generatedEmails.add(email);

      // Create valid Phone Number matching /^\+?[1-9]\d{6,14}$/
      const phone = `+1301555${String(i).padStart(4, "0")}`;

      const monthlySalary = Math.floor(30000 + Math.random() * 120000);
      const overtimeRate = Math.floor(100 + Math.random() * 400);

      employeesToInsert.push({
        fullName,
        email,
        phone,
        role: faker.person.jobTitle(),
        department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
        monthlySalary,
        overtimeRate,
        companyName: "PaySphere Dev Tenant",
        dateOfBirth: faker.date.past(),
        joiningDate: faker.date.between({
          from: new Date("2020-01-01"),
          to: new Date("2025-12-31")
        }),
        currency: "INR",
        createdBy: admin._id,
        tenantId: tenant._id,
        bankDetails: {
          bankName: faker.finance.accountNumber(10) ? `${faker.person.firstName()}'s Bank` : "HDFC Bank",
          accountNumber: faker.finance.accountNumber(12),
          routingCode: faker.finance.routingNumber() || "HDFC0001234",
        }
      });
    }

    const insertedEmployees = await Employee.insertMany(employeesToInsert);
    logger.info(`Inserted ${insertedEmployees.length} dev employees.`);

    // 5. Generate 3 months of payroll history for each employee (Total 1500+ records)
    logger.info("Generating payroll records...");
    const payrollRecords = [];

    // May, June, July of 2026
    const months = [
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
      { month: 7, year: 2026 }
    ];

    for (const emp of insertedEmployees) {
      for (const mInfo of months) {
        const overtimeHours = Math.floor(Math.random() * 15);
        const bonus = Math.random() > 0.7 ? Math.floor(2000 + Math.random() * 10000) : 0;
        const deductions = Math.random() > 0.8 ? Math.floor(1000 + Math.random() * 4000) : 0;
        const overtimePay = overtimeHours * emp.overtimeRate;
        const netSalary = emp.monthlySalary + overtimePay + bonus - deductions;

        payrollRecords.push({
          employeeId: emp._id,
          employeeName: emp.fullName,
          month: mInfo.month,
          year: mInfo.year,
          baseSalary: emp.monthlySalary,
          overtimeRate: emp.overtimeRate,
          overtimeHours,
          overtimePay,
          bonus,
          deductions,
          netSalary,
          currency: "INR",
          status: "paid",
          createdBy: admin._id,
          tenantId: tenant._id,
        });
      }
    }

    // Insert in chunks of 500 for performance
    const chunkSize = 500;
    for (let i = 0; i < payrollRecords.length; i += chunkSize) {
      const chunk = payrollRecords.slice(i, i + chunkSize);
      await PayrollUpdate.insertMany(chunk);
    }

    logger.info(`Inserted ${payrollRecords.length} dev payroll history records.`);
    return { success: true, employeesCount: insertedEmployees.length, payrollsCount: payrollRecords.length };
  } catch (error) {
    logger.error("Dev database seeding failed", { error: error.message });
    throw error;
  }
};

// Expose runner so it can be called standalone
if (require.main === module) {
  const runSeeder = async () => {
    try {
      await connectDB();
      const result = await seedDevDatabase();
      logger.info(`Dev Seeding Completed Successfully! Created ${result.employeesCount} employees and ${result.payrollsCount} payrolls.`);
      await mongoose.disconnect();
      process.exit(0);
    } catch (e) {
      await mongoose.disconnect();
      process.exit(1);
    }
  };
  runSeeder();
}

module.exports = { seedDevDatabase };
