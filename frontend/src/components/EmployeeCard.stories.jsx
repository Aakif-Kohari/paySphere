import React from 'react';
import EmployeeCard from './EmployeeCard';

export default {
  title: 'Components/EmployeeCard',
  component: EmployeeCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'radio',
      options: ['overview', 'breakdown'],
    },
    onAddUpdate: { action: 'onAddUpdate' },
    onDeleteEmployee: { action: 'onDeleteEmployee' },
    onEdit: { action: 'onEdit' },
  },
};

const mockEmployee = {
  _id: 'emp-123',
  fullName: 'Alice Smith',
  role: 'Software Engineer',
  monthlySalary: 8500,
  isActive: true,
};

const mockPayroll = {
  _id: 'pay-456',
  month: 8,
  year: 2026,
  status: 'Draft',
  salaryStructure: {
    baseSalary: 6000,
    hra: 1500,
    specialAllowance: 1000,
    leaveDeduction: 0,
  },
};

export const Overview = {
  args: {
    emp: mockEmployee,
    payroll: null,
    variant: 'overview',
  },
};

export const BreakdownWithoutPayroll = {
  args: {
    emp: mockEmployee,
    payroll: null,
    variant: 'breakdown',
  },
};

export const BreakdownWithPayroll = {
  args: {
    emp: mockEmployee,
    payroll: mockPayroll,
    variant: 'breakdown',
  },
};
