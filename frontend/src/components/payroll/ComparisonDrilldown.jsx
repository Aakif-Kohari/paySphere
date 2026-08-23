import React, { useState, useEffect } from "react";
import api from "../../services/api";
import "./ComparisonDrilldown.module.css";
import { formatCurrency } from "../../utils/currency"; // Assuming we have a helper

export default function ComparisonDrilldown({ isOpen, onClose, comparisonRecord }) {
  if (!isOpen || !comparisonRecord) return null;

  const { periodA, periodB, diff, employeeName, anomalies } = comparisonRecord;

  // Render a field comparison row
  const renderRow = (label, valA, valB, diffVal, isCurrency = true) => {
    const fmt = isCurrency ? (val) => (val != null ? formatCurrency(val) : "-") : (val) => (val != null ? val : "-");
    const diffFmt = isCurrency ? (val) => (val != null ? formatCurrency(val) : "-") : (val) => (val != null ? val : "-");
    
    let diffClass = "";
    if (diffVal > 0) diffClass = "diff-positive";
    if (diffVal < 0) diffClass = "diff-negative";

    return (
      <div className="comparison-row">
        <div className="row-label">{label}</div>
        <div className="row-val">{fmt(valA)}</div>
        <div className="row-val">{fmt(valB)}</div>
        <div className={`row-diff ${diffClass}`}>
           {diffVal > 0 ? "+" : ""}{diffFmt(diffVal)}
        </div>
      </div>
    );
  };

  return (
    <div className={`drilldown-drawer ${isOpen ? "open" : ""}`}>
      <div className="drilldown-header">
        <h3>{employeeName} - Payroll Comparison</h3>
        <button onClick={onClose} className="close-btn">&times;</button>
      </div>

      <div className="drilldown-content">
        {anomalies && anomalies.length > 0 && (
          <div className="anomalies-section">
            <h4>Flags</h4>
            {anomalies.map((anom, idx) => (
              <div key={idx} className={`anomaly-alert ${anom.type.toLowerCase()}`}>
                <strong>{anom.type}:</strong> {anom.reason}
              </div>
            ))}
          </div>
        )}

        <div className="comparison-table">
          <div className="comparison-header">
            <div>Field</div>
            <div>Previous Period</div>
            <div>Current Period</div>
            <div>Difference</div>
          </div>
          
          {renderRow("Base Salary", periodA?.baseSalary, periodB?.baseSalary, diff?.baseSalary)}
          {renderRow("Bonus", periodA?.bonus, periodB?.bonus, diff?.bonus)}
          {renderRow("Deductions", periodA?.deductions, periodB?.deductions, diff?.deductions)}
          {renderRow("Leave Days", periodA?.leaveDays, periodB?.leaveDays, diff?.leaveDays, false)}
          
          <div className="comparison-row net-pay-row">
            <div className="row-label"><strong>Net Pay</strong></div>
            <div className="row-val"><strong>{formatCurrency(periodA?.netSalary)}</strong></div>
            <div className="row-val"><strong>{formatCurrency(periodB?.netSalary)}</strong></div>
            <div className={`row-diff ${diff?.netSalary > 0 ? "diff-positive" : diff?.netSalary < 0 ? "diff-negative" : ""}`}>
              <strong>{diff?.netSalary > 0 ? "+" : ""}{formatCurrency(diff?.netSalary)}</strong>
              {diff?.netSalaryPct != null && (
                 <span className="pct-diff"> ({diff.netSalaryPct > 0 ? "+" : ""}{diff.netSalaryPct.toFixed(1)}%)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
