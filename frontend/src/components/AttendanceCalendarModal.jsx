import React, { useState, useEffect } from "react";

// Status configuration definitions
const STATUS_CONFIG = {
  PRESENT: { label: "Present", code: "P", bg: "#10B981", lightBg: "#ECFDF5", text: "#065F46", darkBg: "#064E3B", darkText: "#A7F3D0" },
  HALF_DAY: { label: "Half Day", code: "HD", bg: "#F59E0B", lightBg: "#FFFBEB", text: "#92400E", darkBg: "#78350F", darkText: "#FDE68A" },
  ABSENT: { label: "Unpaid Leave", code: "A", bg: "#EF4444", lightBg: "#FEF2F2", text: "#991B1B", darkBg: "#7F1D1D", darkText: "#FCA5A5" },
  PAID_LEAVE: { label: "Paid Leave", code: "PL", bg: "#3B82F6", lightBg: "#EFF6FF", text: "#1E40AF", darkBg: "#1E3A8A", darkText: "#BFDBFE" },
  OVERTIME: { label: "Overtime", code: "OT", bg: "#8B5CF6", lightBg: "#F5F3FF", text: "#5B21B6", darkBg: "#4C1D95", darkText: "#DDD6FE" },
};

const STATUS_KEYS = Object.keys(STATUS_CONFIG);

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

  // Reset or initialize when modal opens or employee changes
  useEffect(() => {
    if (isOpen && employee) {
      const initial = {};
      for (let d = 1; d <= daysInMonth; d++) {
        // Default to PRESENT for working days (Mon-Sat, Sun absent/off optional)
        const dateObj = new Date(year, month, d);
        const isSunday = dateObj.getDay() === 0;
        initial[d] = {
          status: isSunday ? "PAID_LEAVE" : "PRESENT",
          otHours: 0,
        };
      }
      setDayStates(initial);
    }
  }, [isOpen, employee, year, month, daysInMonth]);

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

    onApply({
      employeeName: employee.fullName,
      tags,
      summary: { presentDays, halfDays, unpaidLeaves, paidLeaves, totalOtHours },
    });
    onClose();
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
              onClick={handleApplyToPayroll}
              style={{
                padding: "9px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#2563EB",
                color: "white",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              }}
            >
              Apply to Payroll ⚡
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
