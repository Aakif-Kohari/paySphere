import { TimeEntryModel, AttendanceRecordModel, ShiftScheduleModel, OvertimeRuleModel } from '../models/EnterpriseTimeAttendanceModel';
export declare class EnterpriseTimeAttendanceService {
    private timeEntries;
    private attendanceRecords;
    private shifts;
    private overtimeRules;
    constructor();
    getTimeEntries(filters?: {
        departmentCode?: string;
        status?: string;
        employeeId?: string;
    }): TimeEntryModel[];
    getTimeEntryById(id: string): TimeEntryModel | undefined;
    approveTimeEntry(id: string, approverId: string): TimeEntryModel | null;
    rejectTimeEntry(id: string, reason: string): TimeEntryModel | null;
    getAttendanceRecords(filters?: {
        departmentCode?: string;
        complianceStatus?: string;
    }): AttendanceRecordModel[];
    getDashboardMetrics(): {
        totalEmployees: number;
        presentToday: number;
        absentToday: number;
        totalRegularHours: number;
        totalOvertimeHours: number;
        overtimeCostEstimateUSD: number;
        compliantPercentage: number;
        flaggedEntries: number;
        avgAttendance: number;
    };
    getShifts(): ShiftScheduleModel[];
    getOvertimeRules(): OvertimeRuleModel[];
}
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=EnterpriseTimeAttendanceService.d.ts.map