import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import Dashboard from "../Dashboard";
import api from "../../services/api";

// ── Test doubles ────────────────────────────────────────────────────────────
// The dashboard depends on routing, global state, i18n and the API client. The API is
// stubbed with per-endpoint fixtures so charts/metrics can be asserted against
// known numbers. Several leaf components are stubbed because they depend on
// packages that are not installed in this workspace (@mui/*, @dnd-kit/*) or
// carry pre-existing defects (Sidebar references an undefined SchoolIcon).
const { navigate, storeState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  storeState: { token: 'test-token', logout: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("../../store/useAppStore", () => ({
  useAppStore: (selector) => selector(storeState),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, fallbackOrOptions, maybeOptions) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions;
      if (fallbackOrOptions && typeof fallbackOrOptions === 'object' && fallbackOrOptions.defaultValue) {
        return fallbackOrOptions.defaultValue;
      }
      if (maybeOptions && typeof maybeOptions === 'object' && maybeOptions.defaultValue) {
        return maybeOptions.defaultValue;
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

// @mui/* is not installed in this workspace but is imported by several leaf
// components; the mocks keep the page's module graph importable in jsdom.
vi.mock("@mui/material", () => ({
  Alert: () => null,
  Snackbar: () => null,
}));
vi.mock("@mui/icons-material/FileDownload", () => ({ default: () => null }));
vi.mock("@mui/icons-material/PictureAsPdf", () => ({ default: () => null }));
vi.mock("@mui/icons-material/InfoOutlined", () => ({ default: () => null }));
vi.mock("@mui/icons-material/EditOutlined", () => ({ default: () => null }));
vi.mock("@mui/icons-material/DarkModeOutlined", () => ({ default: () => null }));
vi.mock("@mui/icons-material/LightModeOutlined", () => ({ default: () => null }));

vi.mock("../../components/Sidebar", () => ({
  default: () => null,
}));

vi.mock("../../components/ThemeToggle", () => ({
  default: () => null,
}));

vi.mock("../../components/SettingsModal", () => ({
  default: () => null,
}));

vi.mock("../../components/EmployeeExportActions", () => ({
  default: () => null,
}));

vi.mock("../../components/EmployeeCard", () => ({
  default: ({ emp, payroll }) => (
    <div data-testid="employee-card">
      {emp.fullName} — {emp.role}
      {payroll && <span data-testid="payroll-net">{payroll.netSalary}</span>}
    </div>
  ),
}));

// The skeleton is stubbed so the loading view never leaks into assertions.
// (Dashboard.jsx previously imported this path before the misspelled file
// "DashboardSeketon.jsx" was renamed to DashboardSkeleton.jsx.)
vi.mock("../../components/common/skeleton/DashboardSkeleton", () => ({
  default: () => null,
}));

// These tab modules import @mui/material, which is not installed in this
// workspace; the dashboard only renders them after switching tabs, so the
// stubs keep the default "Dashboard" view renderable in jsdom.
vi.mock("../Approvals", () => ({ default: () => null }));
vi.mock("../Loans", () => ({ default: () => null }));
vi.mock("../Settlements", () => ({ default: () => null }));

vi.mock("../../hooks/useDashboardData", () => ({
  useDashboardSummary: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
  useRecentActivity: () => ({ data: [], isLoading: false }),
  usePayrollTrend: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../components/LanguageSwitcher", () => ({
  default: () => null,
}));

vi.mock("../../components/BottomNavBar", () => ({
  default: () => null,
}));

vi.mock("../../components/dashboard/DashboardGrid", () => ({
  default: () => null,
}));

vi.mock("../Archive", () => ({ default: () => null }));

// ── Fixtures ────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  {
    _id: "e1",
    fullName: "Rahul Sharma",
    role: "Payroll Manager",
    monthlySalary: 50000,
    currency: "INR",
  },
  {
    _id: "e2",
    fullName: "Anita Verma",
    role: "Software Engineer",
    monthlySalary: 30000,
    currency: "INR",
  },
];

const stubApi = ({ employees = EMPLOYEES, payrolls = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url.includes("/api/employees")) {
      return Promise.resolve({
        data: {
          employees,
          totalPages: 1,
          totalEmployees: employees.length,
        },
      });
    }
    if (url.includes("page=")) {
      return Promise.resolve({
        data: { payrolls, totalPages: 1, totalCount: payrolls.length },
      });
    }
    return Promise.resolve({ data: { payrolls } });
  });
  api.post.mockResolvedValue({ data: {} });
  api.put.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
};

const renderDashboard = () => render(<Dashboard />);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("token", "test-token");
  localStorage.setItem("currency", "INR");
  stubApi();
  navigate.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("PaySphere dashboard", () => {
  test("renders the summary metrics from the mocked API responses", async () => {
    renderDashboard();

    expect(await screen.findByText("Monthly Overview")).toBeInTheDocument();
    expect(screen.getByText("Total Monthly Payout")).toBeInTheDocument();
    // 50000 + 30000 = 80000 → ₹80,000.00 (en-IN formatting)
    expect(screen.getByText("₹80,000.00")).toBeInTheDocument();
    expect(screen.getByText("2 employees on payroll")).toBeInTheDocument();
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByText("Employee Directory")).toBeInTheDocument();

    // Both list requests fire on mount: employees + payroll summary.
    expect(api.get).toHaveBeenCalledWith("/api/employees?page=1&limit=10");
    expect(api.get).toHaveBeenCalledWith("/api/payroll/summary?limit=0");
  });

  test("shows an employee card for each mocked employee", async () => {
    renderDashboard();

    const cards = await screen.findAllByTestId("employee-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Rahul Sharma — Payroll Manager")).toBeInTheDocument();
    expect(screen.getByText("Anita Verma — Software Engineer")).toBeInTheDocument();
  });

  test("uses payroll netSalary when computing the monthly payout", async () => {
    stubApi({
      payrolls: [{ employeeId: "e1", netSalary: 25000, status: "approved" }],
    });
    renderDashboard();

    // e1's payout comes from payroll (25000), e2 falls back to salary (30000).
    expect(await screen.findByText("₹55,000.00")).toBeInTheDocument();
  });

  test("filters the directory when the user types in the search box", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Rahul Sharma — Payroll Manager");

    const [searchInput] = screen.getAllByPlaceholderText("Search employees...");
    await user.type(searchInput, "Anita");

    expect(screen.queryByText("Rahul Sharma — Payroll Manager")).not.toBeInTheDocument();
    expect(screen.getByText("Anita Verma — Software Engineer")).toBeInTheDocument();
  });

  test("shows the empty-search state when no employee matches", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Rahul Sharma — Payroll Manager");

    const [searchInput] = screen.getAllByPlaceholderText("Search employees...");
    await user.type(searchInput, "zzz-no-match");

    expect(screen.getByText(/no employees match "zzz-no-match"/i)).toBeInTheDocument();
    expect(screen.getByText("No employees found")).toBeInTheDocument();
  });

  test("filters the directory when the user selects a role filter", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Rahul Sharma — Payroll Manager");

    const roleSelect = screen.getByLabelText("Filter by role");
    await user.selectOptions(roleSelect, "Software Engineer");

    expect(screen.queryByText("Rahul Sharma — Payroll Manager")).not.toBeInTheDocument();
    expect(screen.getByText("Anita Verma — Software Engineer")).toBeInTheDocument();
  });

  test("shows the empty state and offers to add an employee when the roster is empty", async () => {
    const user = userEvent.setup();
    stubApi({ employees: [] });
    renderDashboard();

    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
    expect(
      screen.getByText(/add your first employee to get started with payroll/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add employee/i }));
    expect(navigate).toHaveBeenCalledWith("/add-employee");
  });

  test("navigates to the monthly-updates flow from Run Payroll", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Total Monthly Payout");

    await user.click(screen.getByRole("button", { name: /run payroll/i }));
    expect(navigate).toHaveBeenCalledWith("/monthly-updates");
  });

  test("navigates to the reports page from the Reports button", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Total Monthly Payout");

    await user.click(screen.getByRole("button", { name: /reports/i }));
    expect(navigate).toHaveBeenCalledWith("/reports");
  });

  test("dismissing the Getting Started card hides it and persists the choice", async () => {
    const user = userEvent.setup();
    const { unmount } = renderDashboard();

    expect(await screen.findByText(/getting started/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss tutorial/i }));
    expect(screen.queryByText(/getting started/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("showGettingStartedCard")).toBe("false");

    // A fresh mount respects the persisted choice (card stays hidden).
    unmount();
    cleanup();
    stubApi();
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByText(/getting started/i)).not.toBeInTheDocument();
    });
  });
});
