import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import AddEmployee from "../AddEmployee";
import api from "../../services/api";

// ── Test doubles ────────────────────────────────────────────────────────────
// AddEmployee relies on routing, global state and the API client. Each is replaced
// with a lightweight stub so the test can drive the form in isolation.
const { navigate, storeState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  storeState: { logout: vi.fn() },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../../store/useAppStore", () => ({ useAppStore: (selector) => selector(storeState) }));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../../hooks/useCtrlEnterSubmit", () => ({
  default: () => {},
}));

vi.mock("../../components/ThemeToggle", () => ({
  default: () => null,
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

const renderForm = () => {
  const utils = render(<AddEmployee />);
  return {
    ...utils,
    form: utils.container.querySelector("form"),
    phoneInput: utils.container.querySelector("#employee-phone"),
  };
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("token", "test-token");
  api.get.mockResolvedValue({ data: { employees: [], roles: [] } });
  api.post.mockResolvedValue({ data: { employee: { _id: "emp-1" } } });
  navigate.mockClear();
  dispatch.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Add Employee form", () => {
  test("renders the form with its key fields", async () => {
    renderForm();

    expect(
      screen.getByRole("heading", { name: /add employee/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^role$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monthly salary/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 9876543210")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add employee/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

    // The recent-employees panel and the role datalist are both fetched on mount.
    // The employees fetch is deferred through a setTimeout(0), so await it.
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/api/employees?page=1&limit=5");
    });
    expect(api.get).toHaveBeenCalledWith("/api/roles");
  });

  test("reflects user typing in the field values", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.type(screen.getByLabelText(/^role$/i), "Payroll Manager");
    await user.type(screen.getByLabelText(/department/i), "Finance");
    await user.type(screen.getByLabelText(/monthly salary/i), "45,000");
    await user.type(screen.getByLabelText(/overtime rate/i), "250");

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Rahul Sharma");
    expect(screen.getByLabelText(/^role$/i)).toHaveValue("Payroll Manager");
    expect(screen.getByLabelText(/department/i)).toHaveValue("Finance");
    expect(screen.getByLabelText(/monthly salary/i)).toHaveValue("45,000");
    expect(screen.getByLabelText(/overtime rate/i)).toHaveValue("250");
  });

  test("shows a validation error when the salary is missing", () => {
    const { form } = renderForm();

    // jsdom does not run interactive constraint validation on submit, so a
    // direct submit event reaches the handler and exercises the salary check.
    fireEvent.submit(form);

    expect(
      screen.getByText(/monthly salary must be a positive number/i)
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("rejects a zero salary with a validation error", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.type(screen.getByLabelText(/^role$/i), "Payroll Manager");
    await user.type(screen.getByLabelText(/monthly salary/i), "0");
    await user.click(screen.getByRole("button", { name: /add employee/i }));

    expect(
      screen.getByText(/monthly salary must be a positive number/i)
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("shows an error when the phone number is invalid on submit", async () => {
    const user = userEvent.setup();
    const { phoneInput } = renderForm();

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.type(screen.getByLabelText(/^role$/i), "Payroll Manager");
    await user.type(screen.getByLabelText(/monthly salary/i), "45,000");
    await user.type(phoneInput, "123");
    await user.click(screen.getByRole("button", { name: /add employee/i }));

    expect(
      screen.getByText(/please enter a valid international phone number/i)
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("validates the phone inline on blur and clears the error for a valid number", async () => {
    const user = userEvent.setup();
    const { phoneInput } = renderForm();

    await user.type(phoneInput, "123");
    fireEvent.blur(phoneInput);

    expect(
      screen.getByText(/enter a valid international phone number/i)
    ).toBeInTheDocument();

    await user.clear(phoneInput);
    await user.type(phoneInput, "9876543210");
    fireEvent.blur(phoneInput);

    expect(
      screen.queryByText(/enter a valid international phone number/i)
    ).not.toBeInTheDocument();
  });

  test("submits successfully, posts the expected payload and clears the form", async () => {
    const user = userEvent.setup();
    const { phoneInput } = renderForm();

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.type(screen.getByLabelText(/^role$/i), "Payroll Manager");
    await user.type(screen.getByLabelText(/department/i), "Finance");
    await user.type(screen.getByLabelText(/monthly salary/i), "45,000");
    await user.type(screen.getByLabelText(/overtime rate/i), "250");
    await user.type(phoneInput, "9876543210");
    await user.type(screen.getByLabelText(/date of birth/i), "1995-04-12");
    await user.type(screen.getByLabelText(/joining date/i), "2023-06-01");

    await user.click(screen.getByRole("button", { name: /add employee/i }));

    expect(api.post).toHaveBeenCalledWith(
      "/api/employees",
      expect.objectContaining({
        fullName: "Rahul Sharma",
        role: "Payroll Manager",
        department: "Finance",
        monthlySalary: 45000,
        overtimeRate: 250,
        currency: "INR",
        phone: "+919876543210",
        dateOfBirth: expect.any(Date),
        joiningDate: expect.any(Date),
      })
    );

    expect(screen.getByText(/employee added successfully/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.getByLabelText(/monthly salary/i)).toHaveValue("");
    expect(screen.getByLabelText(/^role$/i)).toHaveValue("");
  });

  test("shows the API error message when the request fails", async () => {
    const user = userEvent.setup();
    const { phoneInput } = renderForm();

    api.post.mockRejectedValueOnce({
      response: { data: { message: "An employee with this phone already exists." } },
    });

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.type(screen.getByLabelText(/^role$/i), "Payroll Manager");
    await user.type(screen.getByLabelText(/monthly salary/i), "45,000");
    await user.type(phoneInput, "9876543210");
    await user.click(screen.getByRole("button", { name: /add employee/i }));

    expect(
      screen.getByText(/an employee with this phone already exists/i)
    ).toBeInTheDocument();
  });

  test("cancel navigates back to the dashboard", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/full name/i), "Rahul Sharma");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });
});
