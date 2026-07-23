import { useState } from "react";

export default function ReportFilters({ onGenerate, loading ,successMessage}) {
  const [filters, setFilters] = useState({
    month: "All",
    year: "All",
    department: "All",
    employee: "All",
    status: "All",
  });

  const handleChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
        Generate Payroll Report
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Month */}
        <select
          name="month"
          value={filters.month}
          onChange={handleChange}
          className="px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
          <option value="Months">Months</option>
          <option>January</option>
          <option>February</option>
          <option>March</option>
          <option>April</option>
          <option>May</option>
          <option>June</option>
          <option>July</option>
          <option>August</option>
          <option>September</option>
          <option>October</option>
          <option>November</option>
          <option>December</option>
        </select>

        {/* Year */}
        <select
          name="year"
          value={filters.year}
          onChange={handleChange}
          className="px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
          <option value="Years">Years</option>
          <option>2024</option>
          <option>2025</option>
          <option>2026</option>
        </select>

        {/* Department */}
        <select
          name="department"
          value={filters.department}
          onChange={handleChange}
          className="px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
          <option value="Departments"> Departments</option>
          <option>Engineering</option>
          <option>HR</option>
          <option>Finance</option>
          <option>Sales</option>
          <option>Operations</option>
          <option>Marketing</option>
        </select>

        {/* Employee */}
        <select
          name="employee"
          value={filters.employee}
          onChange={handleChange}
          className="px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
           <option value=" Employees"> Employees</option>
           <option>Rahul Sharma</option>
           <option>Priya Singh</option>
           <option>Neha Verma</option>
           <option>Arjun Mehta</option>
           <option>Amit Kumar</option>
           <option>Sneha Gupta</option>
           <option>Rohit Jain</option>
           <option>Pooja Nair</option>
           <option>Karan Patel</option>
           <option>Meera Iyer</option>
           <option>Vikram Rao</option>
           <option>Kavya Sharma</option>
           <option>Aditya Kapoor</option>
           <option>Nisha Agarwal</option>
           <option>Sahil Arora</option>
           <option>Ananya Das</option>
           <option>Harsh Vardhan</option>
           <option>Riya Malhotra</option>
           <option>Akash Yadav</option>
           <option>Simran Kaur</option>
           <option>Rakesh Verma</option>
           <option>Pallavi Joshi</option>
           <option>Nitin Sharma</option>
           <option>Anjali Menon</option>
           <option>Deepak Gupta</option>
           <option>Snehal Patil</option>
           <option>Mohit Arora</option>
           <option>Isha Kapoor</option>
           <option>Kunal Desai</option>
           <option>Priyanka Roy</option>
    </select>

        {/* Status */}
        <select
          name="status"
          value={filters.status}
          onChange={handleChange}
          className="px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950"
        >
          <option value="Status"> Status</option>
          <option>Paid</option>
          <option>Pending</option>
        </select>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="flex items-center gap-3">

  {successMessage && (
    <span className="text-green-600 font-medium text-sm">
      {successMessage}
    </span>
  )}

  <button
    onClick={() => onGenerate(filters)}
    disabled={loading}
    className={`px-6 py-3 rounded-lg font-semibold text-white transition ${
      loading
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-blue-600 hover:bg-blue-700"
    }`}
  >
    {loading ? "Generating..." : "Generate Report"}
  </button>

</div>
      </div>
    </div>
  );
}