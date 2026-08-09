import { configureStore } from '@reduxjs/toolkit';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import uiReducer from '../../features/ui/uiSlice';
import Sidebar from '../Sidebar';

describe('Sidebar theme toggle', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it('toggles dark mode and stores the preference in localStorage', () => {
    const store = configureStore({ reducer: { ui: uiReducer } });

    act(() => {
      root.render(
        <Provider store={store}>
          <Sidebar
            companyName="PaySphere"
            activePage="Dashboard"
            setActivePage={() => {}}
            isSidebarOpen={true}
            onClose={() => {}}
          />
        </Provider>,
      );
    });

    const toggle = container.querySelector('input[type="checkbox"]');
    expect(toggle).not.toBeNull();

    act(() => {
      toggle.click();
    });

    expect(localStorage.getItem('themeMode')).toBe('dark');
    expect(toggle.checked).toBe(true);
  });

  it('closes when clicking outside the sidebar on mobile', () => {
    const store = configureStore({ reducer: { ui: uiReducer } });
    const onClose = vi.fn();

    act(() => {
      root.render(
        <Provider store={store}>
          <Sidebar
            companyName="PaySphere"
            activePage="Dashboard"
            setActivePage={() => {}}
            isSidebarOpen={true}
            onClose={onClose}
          />
        </Provider>,
      );
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });
});
