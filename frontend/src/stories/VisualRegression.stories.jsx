import { fn } from 'storybook/test';

import { Button } from './Button';
import { Header } from './Header';
import { Page } from './Page';

const chromatic = {
  chromatic: {
    disableSnapshot: false,
  },
};

export default {
  title: 'Visual Regression/Shared Components',
  parameters: chromatic,
};

export const ButtonPrimary = {
  render: () => <Button primary label="Primary action" onClick={fn()} />,
};

export const ButtonSecondary = {
  render: () => <Button label="Secondary action" onClick={fn()} />,
};

export const ButtonSmall = {
  render: () => (
    <Button primary size="small" label="Small action" onClick={fn()} />
  ),
};

export const ButtonLarge = {
  render: () => (
    <Button primary size="large" label="Large action" onClick={fn()} />
  ),
};

export const ButtonCustomBackground = {
  render: () => (
    <Button
      label="Custom background"
      backgroundColor="#2f6fed"
      onClick={fn()}
    />
  ),
};

export const HeaderLoggedOut = {
  render: () => (
    <Header
      onLogin={fn()}
      onLogout={fn()}
      onCreateAccount={fn()}
    />
  ),
};

export const HeaderLoggedIn = {
  render: () => (
    <Header
      user={{ name: 'Jane Doe' }}
      onLogin={fn()}
      onLogout={fn()}
      onCreateAccount={fn()}
    />
  ),
};

export const HeaderLongUserName = {
  render: () => (
    <Header
      user={{ name: 'Alexandra Johnson-Williams' }}
      onLogin={fn()}
      onLogout={fn()}
      onCreateAccount={fn()}
    />
  ),
};

export const PageLoggedOut = {
  render: () => <Page />,
};

export const PageInteractionState = {
  render: () => <Page />,
  play: async ({ canvasElement }) => {
    const loginButton = canvasElement.querySelector('button');
    loginButton?.click();
  },
};
