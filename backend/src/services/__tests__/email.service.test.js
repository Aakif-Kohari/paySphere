/**
 * Tests for sendPayslipEmail — PDF worker lifecycle (#375)
 *
 * Verifies that pdfWorker.terminate() is called in every exit path and
 * that the returned Promise always settles (no hangs).
 */

const { EventEmitter } = require("events");

// ─── Mock worker_threads ──────────────────────────────────────────────────────
let mockWorkerInstance;

jest.mock("worker_threads", () => {
  const { EventEmitter } = require("events");

  class MockWorker extends EventEmitter {
    constructor() {
      super();
      this.terminate = jest.fn().mockResolvedValue(0);
      this.postMessage = jest.fn();
      // expose reference so tests can drive events
      mockWorkerInstance = this;
    }
  }

  return { Worker: MockWorker };
});

// ─── Mock dependencies ────────────────────────────────────────────────────────
jest.mock("../../utils/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// ─── Subject under test ───────────────────────────────────────────────────────
const { sendPayslipEmail } = require("../email.service");
const { sendEmail } = require("../../utils/email");

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const employee = { fullName: "Alice Smith", email: "alice@example.com" };
const payroll = { month: 7, year: 2026 };
const fakePdfData = Buffer.from("PDF_CONTENT").toJSON().data; // array of bytes

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("sendPayslipEmail — PDF worker lifecycle (#375)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockWorkerInstance = null;
  });

  // ── 1. Happy path ────────────────────────────────────────────────────────────
  test("resolves and terminates worker on successful PDF + email send", async () => {
    sendEmail.mockResolvedValue({ success: true });

    const promise = sendPayslipEmail(employee, payroll);

    // Worker emits success message
    mockWorkerInstance.emit("message", { success: true, pdfData: fakePdfData });

    await expect(promise).resolves.toEqual({ success: true });
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // ── 2. SMTP failure — must terminate worker (was the primary bug) ─────────────
  test("rejects and terminates worker when sendEmail() throws (SMTP failure)", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP connection refused"));

    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("message", { success: true, pdfData: fakePdfData });

    await expect(promise).rejects.toThrow("SMTP connection refused");
    // terminate() must have been called even though sendEmail() threw
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // ── 3. sendEmail returns success:false — must terminate worker ────────────────
  test("rejects and terminates worker when sendEmail() returns success:false", async () => {
    sendEmail.mockResolvedValue({ success: false, error: "Proxy error" });

    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("message", { success: true, pdfData: fakePdfData });

    await expect(promise).rejects.toThrow("Proxy error");
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // ── 4. PDF generation failure — must terminate worker ─────────────────────────
  test("rejects and terminates worker when PDF generation fails", async () => {
    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("message", {
      success: false,
      error: "Out of memory",
    });

    await expect(promise).rejects.toThrow("PDF Generation failed: Out of memory");
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // ── 5. Worker emits 'error' event ─────────────────────────────────────────────
  test("rejects and terminates worker when worker emits an error event", async () => {
    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("error", new Error("Worker crashed"));

    await expect(promise).rejects.toThrow("Worker crashed");
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // ── 6. Silent worker crash — exit event with non-zero code (was hanging bug) ──
  test("rejects when worker exits silently with non-zero exit code (no message/error)", async () => {
    const promise = sendPayslipEmail(employee, payroll);

    // Simulate silent crash — no 'message' or 'error' emitted, just 'exit'
    mockWorkerInstance.emit("exit", 1);

    await expect(promise).rejects.toThrow(
      "PDF worker exited unexpectedly with code 1"
    );
    // terminate was NOT called by us since the worker is already dead — that's fine
  });

  // ── 7. Worker exits cleanly (code 0) — must NOT reject ───────────────────────
  test("does not reject when worker exits with code 0 after successful send", async () => {
    sendEmail.mockResolvedValue({ success: true });

    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("message", { success: true, pdfData: fakePdfData });
    // Worker then exits cleanly (code 0) — should not cause a double-reject
    mockWorkerInstance.emit("exit", 0);

    await expect(promise).resolves.toEqual({ success: true });
  });

  // ── 8. Double-event guard — settle() prevents double resolve/reject ───────────
  test("does not double-reject when both error and exit events fire", async () => {
    const promise = sendPayslipEmail(employee, payroll);

    mockWorkerInstance.emit("error", new Error("Worker hard crash"));
    mockWorkerInstance.emit("exit", 1); // would be a second rejection without guard

    // Must settle exactly once
    await expect(promise).rejects.toThrow("Worker hard crash");
  });

  // ── 9. No email set — returns undefined immediately without spawning worker ───
  test("returns early without spawning a worker when employee has no email", async () => {
    const result = await sendPayslipEmail(
      { fullName: "Bob", email: null },
      payroll
    );
    expect(result).toBeUndefined();
    expect(mockWorkerInstance).toBeNull(); // Worker was never constructed
  });
});
