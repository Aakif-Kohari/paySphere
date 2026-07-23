import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import ReportFilters from "../components/reports/ReportFilters";
import SummaryCards from "../components/reports/SummaryCards";
import PayrollTrendChart from "../components/reports/PayrollTrendChart";
import DepartmentChart from "../components/reports/DepartmentChart";
import SalaryDistributionChart from "../components/reports/SalaryDistributionChart";
import OvertimeChart from "../components/reports/OvertimeChart";
import PayrollTable from "../components/reports/PayrollTable";

import { payrollTableData } from "../data/reportMockData";

export default function Reports() {
  const navigate = useNavigate();

 const parseAmount = (value) => {
  if (value == null) return 0;

  const amount = Number(
    String(value).replace(/[₹,\s]/g, "")
  );

  return isNaN(amount) ? 0 : amount;
  };

  const calculateSummary = (data) => {
    const totalPayroll = data.reduce(
      (sum, emp) => sum + parseAmount(emp.net),
      0
    );

    const totalOvertime = data.reduce(
     (sum, emp) => sum + parseAmount(emp.overtime),
      0
     );
     

    const totalDeductions = data.reduce(
      (sum, emp) => sum + parseAmount(emp.deduction),
      0
    );

    const employeesPaid = data.filter(
      (emp) => emp.status === "Paid"
    ).length;

    const averageSalary =
      data.length > 0
        ? Math.round(totalPayroll / data.length)
        : 0;

    return {
      totalPayroll: `₹${totalPayroll.toLocaleString("en-IN")}`,
      employeesPaid,
      averageSalary: `₹${averageSalary.toLocaleString("en-IN")}`,
      overtime: `₹${totalOvertime.toLocaleString("en-IN")}`,
      deductions: `₹${totalDeductions.toLocaleString("en-IN")}`,
    };
  };
  const calculateOvertime = (data) =>
    data.map((emp) => ({
      employee: emp.name,
      overtime: parseAmount(emp.overtime),
      deductions: parseAmount(emp.deduction),
    })); 

  const calculateDepartment = (data) => {
    const departments = {};

    data.forEach((emp) => {
      if (!departments[emp.department]) {
        departments[emp.department] = 0;
      }

      departments[emp.department] += parseAmount(emp.net);
    });

    return Object.keys(departments).map((dept) => ({
      department: dept,
      payroll: departments[dept],
    }));
  };

 

 const calculateSalaryDistribution = (data) => {
  const totalSalary = data.reduce(
    (sum, emp) => sum + parseAmount(emp.salary),
    0
  );

  const totalBonus = data.reduce(
    (sum, emp) => sum + parseAmount(emp.bonus),
    0
  );

  const totalOvertime = data.reduce(
    (sum, emp) => sum + parseAmount(emp.overtime),
    0
  );

  return [
    { name: "Salary", value: totalSalary },
    { name: "Bonus", value: totalBonus },
    { name: "Overtime", value: totalOvertime },
  ];
};

  const calculateTrend = (data) => {
  const months = [
      "January",
      "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  ];

  const parseAmount = (value) =>
    Number(value.replace(/[₹,]/g, ""));

  return months.map((month) => ({
    month,
    payroll: data
      .filter((emp) => emp.month === month)
      .reduce((sum, emp) => sum + parseAmount(emp.net), 0),
  }));
};

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [reportData, setReportData] = useState({
    summary: calculateSummary(payrollTableData),
    trend: calculateTrend(payrollTableData),
    department: calculateDepartment(payrollTableData),
    salary: calculateSalaryDistribution(payrollTableData),
    overtime: calculateOvertime(payrollTableData),
    table: payrollTableData,
  });

  const handleGenerate = (selectedFilters) => {
    setLoading(true);
    setSuccessMessage("");

    setTimeout(() => {
      let filtered = [...payrollTableData];

      if (selectedFilters.month !== "All") {
        filtered = filtered.filter(
          (emp) => emp.month === selectedFilters.month
        );
      }

      if (selectedFilters.year !== "All") {
        filtered = filtered.filter(
          (emp) => emp.year === selectedFilters.year
        );
      }

      if (selectedFilters.department !== "All") {
        filtered = filtered.filter(
          (emp) => emp.department === selectedFilters.department
        );
      }

      if (selectedFilters.employee !== "All") {
        filtered = filtered.filter(
          (emp) => emp.name === selectedFilters.employee
        );
      }

      if (selectedFilters.status !== "All") {
        filtered = filtered.filter(
          (emp) => emp.status === selectedFilters.status
        );
      }
      console.log(filtered);
      console.log(calculateTrend(filtered));
      console.log(calculateDepartment(filtered));
      console.log(calculateOvertime(filtered));
      console.log(calculateSalaryDistribution(filtered));
      setReportData({
        summary: calculateSummary(filtered),
        trend: calculateTrend(filtered),
        department: calculateDepartment(filtered),
        salary: calculateSalaryDistribution(filtered),
        overtime: calculateOvertime(filtered),
        table: filtered,
      });

      setLoading(false);
      setSuccessMessage("✓ Report generated successfully!");

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }, 1000);
  };

  return (
         <div className="min-h-screen bg-gray-100 dark:bg-slate-950 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <ArrowBackIcon />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Payroll Reports
            </h1>

            <p className="text-gray-500 dark:text-gray-400">
              Payroll analytics and reporting dashboard
            </p>
          </div>
        </div>

      
      </div>

      <ReportFilters
        onGenerate={handleGenerate}
        loading={loading}
        successMessage={successMessage}
      />

      <div className="h-6" />

      <SummaryCards data={reportData.summary} />

      <div className="h-6" />

      <PayrollTrendChart data={reportData.trend} />

      <div className="h-6" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DepartmentChart data={reportData.department} />
        <SalaryDistributionChart data={reportData.salary} />
      </div>

      <div className="h-6" />

      <OvertimeChart data={reportData.overtime} />

      <div className="h-6" />

      <PayrollTable data={reportData.table} />
            <div className="h-6" />

      


    </div>
  );
}
