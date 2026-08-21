import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RegistrationForm from '../RegistrationForm';

describe('RegistrationForm Component', () => {
  it('renders registration form fields correctly', () => {
    render(<RegistrationForm onSubmit={vi.fn()} />);

    expect(screen.getByText('Create your PaySphere Account')).toBeDefined();
    expect(screen.getByPlaceholderText('Acme Corporation')).toBeDefined();
    expect(screen.getByPlaceholderText('Jane Doe')).toBeDefined();
    expect(screen.getByPlaceholderText('jane@acme.com')).toBeDefined();
    expect(screen.getByText('Get Started with PaySphere')).toBeDefined();
  });

  it('displays validation errors on empty submit', () => {
    const onSubmit = vi.fn();
    render(<RegistrationForm onSubmit={onSubmit} />);

    const submitBtn = screen.getByText('Get Started with PaySphere');
    fireEvent.click(submitBtn);

    expect(screen.getByText('Company name is required')).toBeDefined();
    expect(screen.getByText('Full name is required')).toBeDefined();
    expect(screen.getByText('Email address is required')).toBeDefined();
    expect(screen.getByText('Password is required')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits form when all fields are valid and terms are accepted', () => {
    const onSubmit = vi.fn();
    render(<RegistrationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Acme Corporation'), {
      target: { name: 'companyName', value: 'Nexus Corp' },
    });
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), {
      target: { name: 'fullName', value: 'John Smith' },
    });
    fireEvent.change(screen.getByPlaceholderText('jane@acme.com'), {
      target: { name: 'email', value: 'john@nexus.com' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], {
      target: { name: 'password', value: 'SecretPassword123!' },
    });
    fireEvent.change(passwordInputs[1], {
      target: { name: 'confirmPassword', value: 'SecretPassword123!' },
    });

    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);

    const submitBtn = screen.getByText('Get Started with PaySphere');
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Nexus Corp',
        fullName: 'John Smith',
        email: 'john@nexus.com',
        agreeToTerms: true,
      }),
    );
  });
});
