import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import Sidebar from '../Sidebar';

/**
 * The MemoryRouter and the global auth state are new (#1012).
 *
 * The sidebar used to cancel every click and hand an id back to the parent, so
 * it needed no router context. It renders real router links now — navigation
 * belongs to the component that owns the destination rather than to the
 * fifteen pages that render it, each of which implemented it differently and
 * two of which pointed at paths that were not routes.
 *
 * Auth state is global because the nav is filtered by account type: an
 * employee has a self-service portal, not a payroll console, so showing them
 * "Approvals" advertises a page that will 403.
 */
const renderSidebar = (root, props = {}, preloadedState = {}) => {
  useAppStore.setState({
    user: preloadedState.auth?.user || null,
    themeMode: preloadedState.ui?.themeMode || 'light',
  });

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[props.at || '/dashboard']}>
        <Sidebar
          companyName="PaySphere"
          activePage="Dashboard"
          setActivePage={() => {}}
          isSidebarOpen={true}
          onClose={() => {}}
          {...props}
        />
      </MemoryRouter>,
    );
  });
};

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
    renderSidebar(root);

    const toggle = container.querySelector('input[type="checkbox"]');
    expect(toggle).not.toBeNull();

    act(() => {
      toggle.click();
    });

    expect(localStorage.getItem('themeMode')).toBe('dark');
    expect(toggle.checked).toBe(true);
  });

  it('closes when clicking outside the sidebar on mobile', () => {
    const onClose = vi.fn();

    renderSidebar(root, { onClose });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });
});
