import React from 'react';
import Button from './Button';
import { Home } from '@mui/icons-material';

export default {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
};

export const Primary = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Danger = {
  args: {
    variant: 'danger',
    children: 'Danger Action',
  },
};

export const Loading = {
  args: {
    loading: true,
    children: 'Submitting...',
  },
};

export const WithIcons = {
  args: {
    leftIcon: <Home />,
    children: 'Home',
  },
};
