"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
class EmployeeService {
    /**
     * Constructs the employee document object.
     * Business logic can be expanded here (e.g., auto-generating employee IDs).
     */
    static createEmployeePayload(input) {
        return {
            fullName: input.fullName,
            role: input.role || "",
            monthlySalary: input.monthlySalary,
            overtimeRate: input.overtimeRate || 0,
            companyName: input.companyName,
            createdBy: input.createdBy,
        };
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employee.service.js.map