const Employee = require("../models/employee.model");
const Payroll = require("../models/payroll.model");

const typeDefs = `#graphql
  type Employee {
    id: ID!
    firstName: String
    lastName: String
    email: String
    department: String
    designation: String
    status: String
  }

  type Payroll {
    id: ID!
    employeeId: ID
    basicSalary: Float
    netPay: Float
    status: String
    payPeriod: String
  }

  type Department {
    name: String
    employeeCount: Int
    totalPayroll: Float
  }

  type Query {
    employees(department: String, status: String): [Employee]
    payrolls(status: String, payPeriod: String): [Payroll]
    departments: [Department]
  }
`;

const resolvers = {
  Query: {
    employees: async (_, { department, status }) => {
      const query = {};
      if (department) query.department = department;
      if (status) query.status = status;
      const employees = await Employee.find(query);
      return employees.map(emp => ({
        id: emp._id.toString(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        department: emp.department,
        designation: emp.designation,
        status: emp.status,
      }));
    },
    payrolls: async (_, { status, payPeriod }) => {
      const query = {};
      if (status) query.status = status;
      if (payPeriod) query.payPeriod = payPeriod;
      const payrolls = await Payroll.find(query);
      return payrolls.map(pay => ({
        id: pay._id.toString(),
        employeeId: pay.employeeId,
        basicSalary: pay.basicSalary,
        netPay: pay.netPay,
        status: pay.status,
        payPeriod: pay.payPeriod,
      }));
    },
    departments: async () => {
      const employees = await Employee.find();
      const payrolls = await Payroll.find();
      
      const deptMap = {};
      employees.forEach(emp => {
        const dept = emp.department || "General";
        if (!deptMap[dept]) {
          deptMap[dept] = { name: dept, employeeCount: 0, totalPayroll: 0 };
        }
        deptMap[dept].employeeCount += 1;
      });

      return Object.values(deptMap);
    },
  },
};

module.exports = { typeDefs, resolvers };
