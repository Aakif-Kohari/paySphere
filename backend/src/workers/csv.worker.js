const { workerData, parentPort } = require("worker_threads");
const { createObjectCsvStringifier } = require("csv-writer");

async function generateCSV() {
  try {
    const { payrolls } = workerData;

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: "employeeName", title: "Employee Name" },
        { id: "month", title: "Month" },
        { id: "year", title: "Year" },
        { id: "baseSalary", title: "Base Salary" },
        { id: "leaveDays", title: "Leave Days" },
        { id: "leaveDeduction", title: "Leave Deduction" },
        { id: "overtimeHours", title: "Overtime Hours" },
        { id: "overtimePay", title: "Overtime Pay" },
        { id: "bonus", title: "Bonus" },
        { id: "deductions", title: "Deductions" },
        { id: "netSalary", title: "Net Salary" },
      ],
    });

    const headerRow = csvStringifier.getHeaderString();
    const records = csvStringifier.stringifyRecords(payrolls);

    const result = headerRow + records;

    parentPort.postMessage({ success: true, csvString: result });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
}

generateCSV();
