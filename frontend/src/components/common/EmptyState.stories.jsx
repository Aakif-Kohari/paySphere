import React from 'react';
import EmptyState from './EmptyState';
import Button from './Button';

export default {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export const Default = {
  args: {
    title: 'No Data Found',
    description:
      'We could not find any records matching your search criteria. Try adjusting your filters.',
  },
};

export const WithAction = {
  args: {
    title: 'No Employees Yet',
    description:
      'Get started by adding your first employee to the payroll system.',
    action: <Button variant="primary">Add Employee</Button>,
  },
};
