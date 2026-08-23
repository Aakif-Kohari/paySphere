// @ts-nocheck
export interface EmployeeCreateInput {
  fullName: string;
  role?: string;
  monthlySalary: number;
  overtimeRate?: number;
  companyName: string;
  createdBy: string;
}

export class EmployeeService {
  /**
   * Constructs the employee document object.
   * Business logic can be expanded here (e.g., auto-generating employee IDs).
   */
  public static createEmployeePayload(input: EmployeeCreateInput) {
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
