import React, { useState, useEffect } from "react";
import api from "../../services/api";
import "./PayrollComparisonDashboard.module.css";
import ComparisonDrilldown from "../../components/payroll/ComparisonDrilldown";
import { formatCurrency } from "../../utils/currency";

export default function PayrollComparisonDashboard() {
  const [loading, setLoading] = useState(false);
  const [monthA, setMonthA] = useState(new Date().getMonth());
  const [yearA, setYearA] = useState(new Date().getFullYear());
  const [monthB, setMonthB] = useState(new Date().getMonth() + 1);
  const [yearB, setYearB] = useState(new Date().getFullYear());
  
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/payroll-comparison/compare', {
        params: { monthA, yearA, monthB, yearB }
      });
      setComparisonData(res.data.data);
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    } finally {
      setLoading(false);
    }
  };

  const { deltaSummary, categories } = comparisonData || {};

  return (
    <div className="comparison-dashboard">
      <div className="header-actions">
         <h2>Payroll Comparison & Anomalies</h2>
         <div className="period-selectors">
            {/* simple selectors for demo */}
            <input type="number" value={monthA} onChange={(e) => setMonthA(e.target.value)} />
            <input type="number" value={yearA} onChange={(e) => setYearA(e.target.value)} />
            <span>vs</span>
            <input type="number" value={monthB} onChange={(e) => setMonthB(e.target.value)} />
            <input type="number" value={yearB} onChange={(e) => setYearB(e.target.value)} />
            <button className="primary-btn" onClick={fetchComparison} disabled={loading}>
              {loading ? "Comparing..." : "Compare"}
            </button>
         </div>
      </div>

      {comparisonData && (
        <div className="dashboard-content">
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Net Pay Difference</h3>
              <div className={`amount ${deltaSummary.netPayDiff > 0 ? "positive" : deltaSummary.netPayDiff < 0 ? "negative" : ""}`}>
                {deltaSummary.netPayDiff > 0 ? "+" : ""}{formatCurrency(deltaSummary.netPayDiff)}
              </div>
            </div>
            <div className="summary-card">
              <h3>Critical Anomalies</h3>
              <div className="amount alert">{categories.anomalies.filter(a => a.anomalies.some(an => an.type === 'CRITICAL')).length}</div>
            </div>
            <div className="summary-card">
              <h3>New Hires</h3>
              <div className="amount">{categories.newHires.length}</div>
            </div>
          </div>

          <div className="category-section">
            <h3>Anomalies Requiring Review</h3>
            {categories.anomalies.length === 0 ? (
              <p>No anomalies detected.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Net Pay A</th>
                    <th>Net Pay B</th>
                    <th>Diff</th>
                    <th>Issues</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.anomalies.map(record => (
                    <tr key={record.employeeId}>
                      <td>{record.employeeName}</td>
                      <td>{formatCurrency(record.periodA?.netSalary)}</td>
                      <td>{formatCurrency(record.periodB?.netSalary)}</td>
                      <td>
                        <span className={record.diff.netSalaryPct > 0 ? 'positive' : 'negative'}>
                           {record.diff.netSalaryPct.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        {record.anomalies.map((a, i) => (
                           <div key={i} className={`badge ${a.type.toLowerCase()}`}>{a.type}</div>
                        ))}
                      </td>
                      <td>
                        <button onClick={() => setSelectedRecord(record)}>Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ComparisonDrilldown 
        isOpen={!!selectedRecord} 
        onClose={() => setSelectedRecord(null)} 
        comparisonRecord={selectedRecord} 
      />
    </div>
  );
}
