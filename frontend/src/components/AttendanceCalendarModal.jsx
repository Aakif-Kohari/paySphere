import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api";

// Status configuration definitions.
//
// The keys are the SCREAMING_SNAKE spellings the attendance API accepts as
// legacy aliases, so this grid maps onto the server's canonical vocabulary
// without the client needing to know about it (#459).
const STATUS_CONFIG = {
  PRESENT: { label: "Present", code: "P", bg: "#10B981", lightBg: "#ECFDF5", text: "#065F46", darkBg: "#064E3B", darkText: "#A7F3D0" },
  HALF_DAY: { label: "Half Day", code: "HD", bg: "#F59E0B", lightBg: "#FFFBEB", text: "#92400E", darkBg: "#78350F", darkText: "#FDE68A" },
  ABSENT: { label: "Unpaid Leave", code: "A", bg: "#EF4444", lightBg: "#FEF2F2", text: "#991B1B", darkBg: "#7F1D1D", darkText: "#FCA5A5" },
  PAID_LEAVE: { label: "Paid Leave", code: "PL", bg: "#3B82F6", lightBg: "#EFF6FF", text: "#1E40AF", darkBg: "#1E3A8A", darkText: "#BFDBFE" },
  OVERTIME: { label: "Overtime", code: "OT", bg: "#8B5CF6", lightBg: "#F5F3FF", text: "#5B21B6", darkBg: "#4C1D95", darkText: "#DDD6FE" },
  // A weekly off is not leave. Sundays used to default to PAID_LEAVE, which
  // quietly consumed ~52 days a year against a 12-day entitlement.
  HOLIDAY: { label: "Week Off / Holiday", code: "WO", bg: "#6B7280", lightBg: "#F3F4F6", text: "#374151", darkBg: "#1F2937", darkText: "#D1D5DB" },
};

const STATUS_KEYS = Object.keys(STATUS_CONFIG);

/** Server status -> local key. The server answers in canonical lower_snake. */
const fromServerStatus = (status) => {
  const key = String(status || "").toUpperCase();
  if (STATUS_CONFIG[key]) return key;
  if (key === "UNPAID_LEAVE") return "ABSENT";
  return "PRESENT";
};

export default function AttendanceCalendarModal({ isOpen, onClose, employee, onApply, isDark }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString("default", { month: "long" });

  // Map of day Number (1..daysInMonth) => { status, otHours }
  const [dayStates, setDayStates] = useState({});
  const [selectedDayForOt, setSelectedDayForOt] = useState(null);
  const [otInput, setOtInput] = useState("2");

  // Persistence state (#459). Before this, the grid lived only in React state
  // and was thrown away on close — the month had to be re-keyed from scratch
  // for every employee on every payroll run.
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [balance, setBalance] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const employeeId = employee?._id || employee?.id || null;

  /** Build the local grid from the server's day list. */
  const applyServerDays = useCallback((days) => {
    const next = {};
    (Array.isArray(days) ? days : []).forEach((entry) => {
      next[entry.day] = {
        status: fromServerStatus(entry.status),
        otHours: Number(entry.overtimeHours) || 0,
      };
    });
    setDayStates(next);
  }, []);

  useEffect(() => {
    if (!isOpen || !employeeId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      setSaveError("");

      try {
        const res = await api.get("/api/attendance", {
          params: { employeeId, year, month: month + 1 },
        });
        if (cancelled) return;

        // The server returns a full month either way — a stored grid, or a
        // generated default with week-offs already marked as HOLIDAY — so the
        // client never has to invent one.
        applyServerDays(res.data?.days);
        setBalance(res.data?.balance || null);
        setIsLocked(Boolean(res.data?.isLocked));
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error?.response?.data?.message ||
            "Could not load saved attendance. Showing an empty month.",
        );
        // Fall back to a local default so the grid stays usable offline.
        const fallback = {};
        for (let d = 1; d <= daysInMonth; d += 1) {
          const isSunday = new Date(year, month, d).getDay() === 0;
          fallback[d] = { status: isSunday ? "HOLIDAY" : "PRESENT", otHours: 0 };
        }
        setDayStates(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, employeeId, year, month, daysInMonth, applyServerDays]);

  if (!isOpen || !employee) return null;

  // Cycle through statuses on tile click
  const handleTileClick = (dayNum) => {
    setDayStates((prev) => {
      const current = prev[dayNum] || { status: "PRESENT", otHours: 0 };
      const currentIndex = STATUS_KEYS.indexOf(current.status);
      const nextIndex = (currentIndex + 1) % STATUS_KEYS.length;
      const nextStatus = STATUS_KEYS[nextIndex];

      let newOtHours = current.otHours;
      if (nextStatus === "OVERTIME" && newOtHours === 0) {
        newOtHours = 2; // Default 2 hrs overtime
      }

      return {
        ...prev,
        [dayNum]: { status: nextStatus, otHours: newOtHours },
      };
    });
  };

  // Quick Action: Mark all days
  const handleMarkAll = (targetStatus) => {
    setDayStates((prev) => {
      const updated = { ...prev };
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        if (dateObj.getDay() !== 0) { // Keep Sundays as Paid Leave
          updated[d] = { status: targetStatus, otHours: targetStatus === "OVERTIME" ? 2 : 0 };
        }
      }
      return updated;
    });
  };

  // Calculate totals
  let presentDays = 0;
  let halfDays = 0;
  let unpaidLeaves = 0;
  let paidLeaves = 0;
  let totalOtHours = 0;

  Object.values(dayStates).forEach((item) => {
    if (item.status === "PRESENT") presentDays += 1;
    else if (item.status === "HALF_DAY") {
      halfDays += 1;
      presentDays += 0.5;
      unpaidLeaves += 0.5;
    } else if (item.status === "ABSENT") unpaidLeaves += 1;
    else if (item.status === "PAID_LEAVE") paidLeaves += 1;
    else if (item.status === "OVERTIME") {
      presentDays += 1;
      totalOtHours += Number(item.otHours || 0);
    }
  });

  const handleSaveOt = () => {
    if (selectedDayForOt) {
      setDayStates((prev) => ({
        ...prev,
        [selectedDayForOt]: { status: "OVERTIME", otHours: Math.min(24, Math.max(0.5, parseFloat(otInput) || 0)) },
      }));
      setSelectedDayForOt(null);
    }
  };

  /**
   * Persist the grid, then hand the derived figures to the payroll screen.
   *
   * The server recomputes the totals from the days it is sent and returns the
   * `leaveDays`/`overtimeHours` it derived, so the payroll row is built from
   * the ledger's own arithmetic rather than from numbers this component
   * calculated locally and stringified into a label.
   *
   * @returns {Promise<object|null>} the server's payrollInputs, or null on failure
   */
  const persistGrid = async () => {
    // The "no employees yet" demo path opens this modal with a placeholder that
    // has no id. There is nothing to persist against, so fall back to the
    // locally computed figures rather than blocking the apply.
    if (!employeeId) {
      return { leaveDays: unpaidLeaves, overtimeHours: totalOtHours, unsaved: true };
    }

    setSaving(true);
    setSaveError("");

    const days = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const entry = dayStates[d];
      if (!entry) continue;
      days.push({
        day: d,
        status: entry.status,
        overtimeHours:
          entry.status === "OVERTIME" || entry.status === "HOLIDAY"
            ? Number(entry.otHours) || 0
            : 0,
      });
    }

    try {
      const res = await api.put(
        `/api/attendance/${employeeId}/${year}/${month + 1}`,
        { days },
      );
      setBalance((prev) => prev);
      return res.data?.payrollInputs || null;
    } catch (error) {
      const data = error?.response?.data;
      const detail = Array.isArray(data?.errors) && data.errors.length > 0
        ? ` (day ${data.errors[0].day}: ${data.errors[0].reason})`
        : "";
      setSaveError((data?.message || "Could not save attendance.") + detail);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    const result = await persistGrid();
    if (result) onClose();
  };

  const handleApplyToPayroll = () => {
    const tags = [];
    if (unpaidLeaves > 0) {
      tags.push({
        label: `– ${unpaidLeaves} day${unpaidLeaves > 1 ? "s" : ""} leave`,
        bg: "#FEF2F2",
        color: "#DC2626",
      });
    }
    if (totalOtHours > 0) {
      tags.push({
        label: `+ ${totalOtHours} hr${totalOtHours > 1 ? "s" : ""} overtime`,
        bg: "#EFF6FF",
        color: "#2563EB",
      });
    }

    if (tags.length === 0) {
      tags.push({
        label: `${presentDays} days present`,
        bg: "#F0FDF4",
        color: "#16A34A",
      });
    }

    // Save before applying. If the write fails the modal stays open with the
    // error visible, rather than silently handing payroll figures that are not
    // backed by anything on the server.
    persistGrid().then((payrollInputs) => {
      if (!payrollInputs) return;

      onApply({
        employeeName: employee.fullName,
        employeeId,
        tags,
        // Structured figures straight from the ledger, so the payroll
        // controller no longer has to re-derive them from the tag labels.
        payrollInputs,
        summary: { presentDays, halfDays, unpaidLeaves, paidLeaves, totalOtHours },
      });
      onClose();
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: isDark ? "#111827" : "#FFFFFF",
          color: isDark ? "#F9FAFB" : "#111827",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "780px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: isDark ? "1.5px solid #1E293B" : "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: isDark ? "1px solid #1E293B" : "1px solid #F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>📅</span>
              <h2 style={{ fontSize: "18px", fontWeight: 700 }}>
                Muster Roll Calendar — {employee.fullName}
              </h2>
            </div>
            <p style={{ fontSize: "13px", color: isDark ? "#9CA3AF" : "#6B7280", marginTop: "2px" }}>
              Cycle tiles to log attendance for {monthName} {year}. Click day tile to change status.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "20px",
              color: isDark ? "#9CA3AF" : "#6B7280",
              padding: "4px 8px",
              borderRadius: "8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Legend & Stats Header */}
        <div
          style={{
            padding: "14px 24px",
            background: isDark ? "#1E293B" : "#F9FAFB",
            borderBottom: isDark ? "1px solid #334155" : "1px solid #E5E7EB",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Status Badges Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: isDark ? cfg.darkBg : cfg.lightBg,
                  color: isDark ? cfg.darkText : cfg.text,
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: cfg.bg,
                  }}
                />
                {cfg.label} ({cfg.code})
              </div>
            ))}
          </div>

          {/* Quick Mark Actions */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => handleMarkAll("PRESENT")}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #10B981",
                background: "transparent",
                color: "#10B981",
                cursor: "pointer",
              }}
            >
              Mark All Present
            </button>
          </div>
        </div>

        {/* Persistence status: loading, load failure, save failure, and the
            settled-month lock (#459) */}
        {(loading || loadError || saveError || isLocked) && (
          <div style={{ padding: "10px 24px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {loading && (
              <div style={{ fontSize: "12.5px", color: isDark ? "#93C5FD" : "#1E40AF" }}>
                Loading saved attendance…
              </div>
            )}
            {isLocked && (
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: isDark ? "#1F2937" : "#F3F4F6",
                  color: isDark ? "#D1D5DB" : "#374151",
                }}
              >
                🔒 This month is locked — its payroll has been paid and the record can no longer be edited.
              </div>
            )}
            {loadError && (
              <div style={{ fontSize: "12.5px", color: "#B45309" }}>{loadError}</div>
            )}
            {saveError && (
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: isDark ? "#7F1D1D" : "#FEF2F2",
                  color: isDark ? "#FCA5A5" : "#991B1B",
                }}
              >
                {saveError}
              </div>
            )}
          </div>
        )}

        {/* Summary Counter Bar */}
        <div
          style={{
            padding: "10px 24px",
            background: isDark ? "#0F172A" : "#EEF2FF",
            display: "flex",
            justifyContent: "space-around",
            fontSize: "13px",
            fontWeight: 700,
            color: isDark ? "#93C5FD" : "#1E40AF",
          }}
        >
          <span>🟩 Present: {presentDays}d</span>
          <span>🟧 Half Days: {halfDays}d</span>
          <span>🟥 Unpaid Leave: {unpaidLeaves}d</span>
          <span>⚡ Overtime: {totalOtHours} hrs</span>
          {balance && (
            <span title="Paid leave accrued this leave year, less what has been consumed">
              🏖️ Leave left: {balance.available}d / {balance.entitlement}d
            </span>
          )}
        </div>

        {/* 31-Day Calendar Grid */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "8px",
            }}
          >
            {/* Weekday headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
              <div
                key={dayName}
                style={{
                  textAlign: "center",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: idx === 0 ? "#EF4444" : isDark ? "#9CA3AF" : "#6B7280",
                  textTransform: "uppercase",
                  paddingBottom: "4px",
                }}
              >
                {dayName}
              </div>
            ))}

            {/* Empty offset padding tiles for first day of month */}
            {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => (
              <div key={`blank-${i}`} style={{ height: "54px" }} />
            ))}

            {/* Day tiles */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const d = idx + 1;
              const dateObj = new Date(year, month, d);
              const isSunday = dateObj.getDay() === 0;
              const dayState = dayStates[d] || { status: "PRESENT", otHours: 0 };
              const cfg = STATUS_CONFIG[dayState.status] || STATUS_CONFIG.PRESENT;

              return (
                <div
                  key={d}
                  onClick={() => handleTileClick(d)}
                  style={{
                    height: "58px",
                    borderRadius: "10px",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 0.15s ease",
                    border: isSunday
                      ? "1.5px dashed #3B82F6"
                      : "1px solid " + (isDark ? "#334155" : "#E5E7EB"),
                    background: isDark ? cfg.darkBg : cfg.lightBg,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                  title={`Day ${d}: ${cfg.label}. Click to cycle status.`}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: isDark ? "#F3F4F6" : "#1F2937",
                      }}
                    >
                      {d}
                    </span>
                    {dayState.status === "OVERTIME" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayForOt(d);
                          setOtInput(String(dayState.otHours || 2));
                        }}
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: "4px",
                          border: "none",
                          background: "#8B5CF6",
                          color: "white",
                          cursor: "pointer",
                        }}
                      >
                        {dayState.otHours}h ✏️
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isDark ? cfg.darkText : cfg.text,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: cfg.bg,
                      }}
                    />
                    {cfg.code}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: isDark ? "1px solid #1E293B" : "1px solid #F3F4F6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: isDark ? "#111827" : "#FFFFFF",
          }}
        >
          <span style={{ fontSize: "12.5px", color: isDark ? "#9CA3AF" : "#6B7280" }}>
            Click any tile to cycle status: <b>P → HD → A → PL → OT</b>
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: isDark ? "1px solid #334155" : "1px solid #D1D5DB",
                background: "transparent",
                color: isDark ? "#D1D5DB" : "#374151",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveOnly}
              disabled={saving || loading || isLocked}
              style={{
                padding: "9px 18px",
                borderRadius: "10px",
                border: isDark ? "1px solid #334155" : "1px solid #D1D5DB",
                background: "transparent",
                color: isDark ? "#E5E7EB" : "#374151",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: saving || loading || isLocked ? "not-allowed" : "pointer",
                opacity: saving || loading || isLocked ? 0.5 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Attendance"}
            </button>
            <button
              onClick={handleApplyToPayroll}
              disabled={saving || loading || isLocked}
              style={{
                padding: "9px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#2563EB",
                color: "white",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: saving || loading || isLocked ? "not-allowed" : "pointer",
                opacity: saving || loading || isLocked ? 0.5 : 1,
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              }}
            >
              {saving ? "Saving…" : "Save & Apply to Payroll ⚡"}
            </button>
          </div>
        </div>
      </div>

      {/* Overtime Hours Edit Popover */}
      {selectedDayForOt !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              background: isDark ? "#1E293B" : "white",
              padding: "20px",
              borderRadius: "14px",
              width: "280px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h4 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
              Overtime Hours for Day {selectedDayForOt}
            </h4>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={otInput}
              onChange={(e) => setOtInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                borderRadius: "8px",
                border: "1px solid #D1D5DB",
                marginBottom: "14px",
                outline: "none",
                background: isDark ? "#0F172A" : "white",
                color: isDark ? "white" : "black",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => setSelectedDayForOt(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#9CA3AF",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOt}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#8B5CF6",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Save Hours
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
