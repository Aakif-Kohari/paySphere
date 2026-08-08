import React from 'react';
import Input from './Input';
import { Search } from '@mui/icons-material';

export default {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    type: { control: 'text' },
    fullWidth: { control: 'boolean' },
  },
};

export const Default = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
  },
};

export const WithError = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'Enter your email',
    error: 'Invalid email address format',
  },
};

export const Disabled = {
  args: {
    label: 'Company ID',
    value: 'PAY-88219',
    disabled: true,
  },
};

export const WithIcon = {
  args: {
    label: 'Search',
    placeholder: 'Search employees...',
    leftIcon: <Search />,
  },
};
