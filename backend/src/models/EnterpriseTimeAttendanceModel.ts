// ============================================================================
// Enterprise Time & Attendance Management Suite — Data Models
// PaySphere Enterprise HR Module
// ============================================================================

/**
 * Represents a single time entry (clock-in / clock-out pair) for an employee.
 * Each entry belongs to a specific shift and department, and carries
 * geolocation + biometric verification metadata for compliance audits.
 */
export interface TimeEntryModel {
  entryId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  shiftId: string;
  clockInISO: string;
  clockOutISO: string | null;
  totalHoursWorked: number;
  overtimeHours: number;
  breakMinutes: number;
  status: 'ACTIVE' | 'COMPLETED' | 'APPROVED' | 'FLAGGED' | 'REJECTED';
  clockInLocation: GeolocationSnapshot;
  clockOutLocation: GeolocationSnapshot | null;
  biometricVerified: boolean;
  approvedBy: string | null;
  flaggedReason: string | null;
}

/**
 * GPS + timestamp snapshot captured at clock-in/out for geo-fencing compliance.
 */
export interface GeolocationSnapshot {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtISO: string;
  facilityName: string;
}

/**
 * Aggregated attendance record for an employee over a given pay period.
 * Used by the dashboard to render summary cards and compliance alerts.
 */
export interface AttendanceRecordModel {
  recordId: string;
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  payPeriodStartISO: string;
  payPeriodEndISO: string;
  totalScheduledDays: number;
  totalDaysPresent: number;
  totalDaysAbsent: number;
  totalDaysOnLeave: number;
  totalDaysLate: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  attendancePercentage: number;
  complianceStatus: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
  lastUpdatedISO: string;
}

/**
 * A shift definition — reusable template that multiple employees can be
 * assigned to. Carries the expected clock-in/out windows and break policy.
 */
export interface ShiftScheduleModel {
  shiftId: string;
  shiftName: string;
  departmentCode: string;
  dayOfWeek: number; // 0=Sun … 6=Sat
  expectedClockInISO: string;
  expectedClockOutISO: string;
  gracePeriodMinutes: number;
  breakPolicyMinutes: number;
  maxOvertimeHours: number;
  assignedEmployeeCount: number;
  facilityLocation: GeolocationSnapshot;
  isActive: boolean;
}

/**
 * Overtime rule — defines the legal / policy thresholds for a department.
 * The payroll module reads these to compute premium pay multipliers.
 */
export interface OvertimeRuleModel {
  ruleId: string;
  departmentCode: string;
  departmentName: string;
  dailyRegularHoursCap: number;
  dailyOvertimeCapHours: number;
  weeklyRegularHoursCap: number;
  weeklyOvertimeCapHours: number;
  overtimeMultiplier: number; // e.g. 1.5x
  doubleTimeThresholdHours: number;
  doubleTimeMultiplier: number; // e.g. 2.0x
  weekendMultiplier: number;
  holidayMultiplier: number;
  effectiveFromISO: string;
  effectiveToISO: string | null;
  approvedBy: string;
  lastModifiedISO: string;
}

/**
 * Summary metric used by the dashboard's KPI stat cards.
 */
export interface AttendanceDashboardMetric {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  icon: string;
  accentColor: string;
}

// ============================================================================
// Model Factory Classes
// ============================================================================

export class TimeEntry implements TimeEntryModel {
  public entryId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public shiftId: string;
  public clockInISO: string;
  public clockOutISO: string | null;
  public totalHoursWorked: number;
  public overtimeHours: number;
  public breakMinutes: number;
  public status: TimeEntryModel['status'];
  public clockInLocation: GeolocationSnapshot;
  public clockOutLocation: GeolocationSnapshot | null;
  public biometricVerified: boolean;
  public approvedBy: string | null;
  public flaggedReason: string | null;

  constructor(data: Partial<TimeEntryModel>) {
    this.entryId = data.entryId || `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'Unknown Employee';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.shiftId = data.shiftId || 'shift-01';
    this.clockInISO = data.clockInISO || new Date().toISOString();
    this.clockOutISO = data.clockOutISO || null;
    this.totalHoursWorked = data.totalHoursWorked || 0;
    this.overtimeHours = data.overtimeHours || 0;
    this.breakMinutes = data.breakMinutes || 30;
    this.status = data.status || 'ACTIVE';
    this.clockInLocation = data.clockInLocation || {
      latitude: 40.7128,
      longitude: -74.006,
      accuracyMeters: 5,
      capturedAtISO: this.clockInISO,
      facilityName: 'HQ New York',
    };
    this.clockOutLocation = data.clockOutLocation || null;
    this.biometricVerified = data.biometricVerified ?? true;
    this.approvedBy = data.approvedBy || null;
    this.flaggedReason = data.flaggedReason || null;
  }

  public clockOut(): void {
    this.clockOutISO = new Date().toISOString();
    const clockIn = new Date(this.clockInISO).getTime();
    const clockOut = new Date(this.clockOutISO).getTime();
    const totalMinutes = (clockOut - clockIn) / 60000;
    const workedMinutes = totalMinutes - this.breakMinutes;
    this.totalHoursWorked = Math.round((workedMinutes / 60) * 100) / 100;
    this.overtimeHours = Math.max(0, this.totalHoursWorked - 8);
    this.status = 'COMPLETED';
  }

  public approve(approverId: string): void {
    this.status = 'APPROVED';
    this.approvedBy = approverId;
  }

  public flag(reason: string): void {
    this.status = 'FLAGGED';
    this.flaggedReason = reason;
  }

  public toJSON(): TimeEntryModel {
    return {
      entryId: this.entryId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      shiftId: this.shiftId,
      clockInISO: this.clockInISO,
      clockOutISO: this.clockOutISO,
      totalHoursWorked: this.totalHoursWorked,
      overtimeHours: this.overtimeHours,
      breakMinutes: this.breakMinutes,
      status: this.status,
      clockInLocation: this.clockInLocation,
      clockOutLocation: this.clockOutLocation,
      biometricVerified: this.biometricVerified,
      approvedBy: this.approvedBy,
      flaggedReason: this.flaggedReason,
    };
  }
}

export class AttendanceRecord implements AttendanceRecordModel {
  public recordId: string;
  public employeeId: string;
  public employeeName: string;
  public departmentCode: string;
  public departmentName: string;
  public payPeriodStartISO: string;
  public payPeriodEndISO: string;
  public totalScheduledDays: number;
  public totalDaysPresent: number;
  public totalDaysAbsent: number;
  public totalDaysOnLeave: number;
  public totalDaysLate: number;
  public totalRegularHours: number;
  public totalOvertimeHours: number;
  public attendancePercentage: number;
  public complianceStatus: AttendanceRecordModel['complianceStatus'];
  public lastUpdatedISO: string;

  constructor(data: Partial<AttendanceRecordModel>) {
    this.recordId = data.recordId || `ar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.employeeId = data.employeeId || 'emp-001';
    this.employeeName = data.employeeName || 'Unknown';
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.payPeriodStartISO = data.payPeriodStartISO || new Date().toISOString();
    this.payPeriodEndISO = data.payPeriodEndISO || new Date().toISOString();
    this.totalScheduledDays = data.totalScheduledDays || 22;
    this.totalDaysPresent = data.totalDaysPresent || 0;
    this.totalDaysAbsent = data.totalDaysAbsent || 0;
    this.totalDaysOnLeave = data.totalDaysOnLeave || 0;
    this.totalDaysLate = data.totalDaysLate || 0;
    this.totalRegularHours = data.totalRegularHours || 0;
    this.totalOvertimeHours = data.totalOvertimeHours || 0;
    this.attendancePercentage =
      data.attendancePercentage ??
      (this.totalScheduledDays > 0
        ? Math.round((this.totalDaysPresent / this.totalScheduledDays) * 10000) / 100
        : 0);
    this.complianceStatus = data.complianceStatus || 'UNDER_REVIEW';
    this.lastUpdatedISO = data.lastUpdatedISO || new Date().toISOString();
  }

  public recalculateCompliance(): void {
    if (this.attendancePercentage >= 95) {
      this.complianceStatus = 'COMPLIANT';
    } else if (this.attendancePercentage >= 85) {
      this.complianceStatus = 'WARNING';
    } else {
      this.complianceStatus = 'NON_COMPLIANT';
    }
  }

  public toJSON(): AttendanceRecordModel {
    return {
      recordId: this.recordId,
      employeeId: this.employeeId,
      employeeName: this.employeeName,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      payPeriodStartISO: this.payPeriodStartISO,
      payPeriodEndISO: this.payPeriodEndISO,
      totalScheduledDays: this.totalScheduledDays,
      totalDaysPresent: this.totalDaysPresent,
      totalDaysAbsent: this.totalDaysAbsent,
      totalDaysOnLeave: this.totalDaysOnLeave,
      totalDaysLate: this.totalDaysLate,
      totalRegularHours: this.totalRegularHours,
      totalOvertimeHours: this.totalOvertimeHours,
      attendancePercentage: this.attendancePercentage,
      complianceStatus: this.complianceStatus,
      lastUpdatedISO: this.lastUpdatedISO,
    };
  }
}

export class ShiftSchedule implements ShiftScheduleModel {
  public shiftId: string;
  public shiftName: string;
  public departmentCode: string;
  public dayOfWeek: number;
  public expectedClockInISO: string;
  public expectedClockOutISO: string;
  public gracePeriodMinutes: number;
  public breakPolicyMinutes: number;
  public maxOvertimeHours: number;
  public assignedEmployeeCount: number;
  public facilityLocation: GeolocationSnapshot;
  public isActive: boolean;

  constructor(data: Partial<ShiftScheduleModel>) {
    this.shiftId = data.shiftId || `shift_${Date.now()}`;
    this.shiftName = data.shiftName || 'Morning Shift';
    this.departmentCode = data.departmentCode || 'ENG';
    this.dayOfWeek = data.dayOfWeek ?? 1;
    this.expectedClockInISO = data.expectedClockInISO || '09:00';
    this.expectedClockOutISO = data.expectedClockOutISO || '17:00';
    this.gracePeriodMinutes = data.gracePeriodMinutes || 15;
    this.breakPolicyMinutes = data.breakPolicyMinutes || 60;
    this.maxOvertimeHours = data.maxOvertimeHours || 4;
    this.assignedEmployeeCount = data.assignedEmployeeCount || 0;
    this.facilityLocation = data.facilityLocation || {
      latitude: 40.7128,
      longitude: -74.006,
      accuracyMeters: 10,
      capturedAtISO: new Date().toISOString(),
      facilityName: 'HQ New York',
    };
    this.isActive = data.isActive ?? true;
  }

  public toJSON(): ShiftScheduleModel {
    return {
      shiftId: this.shiftId,
      shiftName: this.shiftName,
      departmentCode: this.departmentCode,
      dayOfWeek: this.dayOfWeek,
      expectedClockInISO: this.expectedClockInISO,
      expectedClockOutISO: this.expectedClockOutISO,
      gracePeriodMinutes: this.gracePeriodMinutes,
      breakPolicyMinutes: this.breakPolicyMinutes,
      maxOvertimeHours: this.maxOvertimeHours,
      assignedEmployeeCount: this.assignedEmployeeCount,
      facilityLocation: this.facilityLocation,
      isActive: this.isActive,
    };
  }
}

export class OvertimeRule implements OvertimeRuleModel {
  public ruleId: string;
  public departmentCode: string;
  public departmentName: string;
  public dailyRegularHoursCap: number;
  public dailyOvertimeCapHours: number;
  public weeklyRegularHoursCap: number;
  public weeklyOvertimeCapHours: number;
  public overtimeMultiplier: number;
  public doubleTimeThresholdHours: number;
  public doubleTimeMultiplier: number;
  public weekendMultiplier: number;
  public holidayMultiplier: number;
  public effectiveFromISO: string;
  public effectiveToISO: string | null;
  public approvedBy: string;
  public lastModifiedISO: string;

  constructor(data: Partial<OvertimeRuleModel>) {
    this.ruleId = data.ruleId || `otr_${Date.now()}`;
    this.departmentCode = data.departmentCode || 'ENG';
    this.departmentName = data.departmentName || 'Engineering';
    this.dailyRegularHoursCap = data.dailyRegularHoursCap || 8;
    this.dailyOvertimeCapHours = data.dailyOvertimeCapHours || 4;
    this.weeklyRegularHoursCap = data.weeklyRegularHoursCap || 40;
    this.weeklyOvertimeCapHours = data.weeklyOvertimeCapHours || 20;
    this.overtimeMultiplier = data.overtimeMultiplier || 1.5;
    this.doubleTimeThresholdHours = data.doubleTimeThresholdHours || 12;
    this.doubleTimeMultiplier = data.doubleTimeMultiplier || 2.0;
    this.weekendMultiplier = data.weekendMultiplier || 2.0;
    this.holidayMultiplier = data.holidayMultiplier || 2.5;
    this.effectiveFromISO = data.effectiveFromISO || new Date().toISOString();
    this.effectiveToISO = data.effectiveToISO || null;
    this.approvedBy = data.approvedBy || 'system';
    this.lastModifiedISO = data.lastModifiedISO || new Date().toISOString();
  }

  public calculateOvertimePay(regularHourlyRate: number, hoursWorked: number): number {
    const regularPay = Math.min(hoursWorked, this.dailyRegularHoursCap) * regularHourlyRate;
    const overtimePay =
      Math.min(
        Math.max(0, hoursWorked - this.dailyRegularHoursCap),
        this.dailyOvertimeCapHours,
      ) *
      regularHourlyRate *
      this.overtimeMultiplier;
    const doubleTimePay =
      Math.max(0, hoursWorked - this.doubleTimeThresholdHours) *
      regularHourlyRate *
      this.doubleTimeMultiplier;
    return Math.round((regularPay + overtimePay + doubleTimePay) * 100) / 100;
  }

  public toJSON(): OvertimeRuleModel {
    return {
      ruleId: this.ruleId,
      departmentCode: this.departmentCode,
      departmentName: this.departmentName,
      dailyRegularHoursCap: this.dailyRegularHoursCap,
      dailyOvertimeCapHours: this.dailyOvertimeCapHours,
      weeklyRegularHoursCap: this.weeklyRegularHoursCap,
      weeklyOvertimeCapHours: this.weeklyOvertimeCapHours,
      overtimeMultiplier: this.overtimeMultiplier,
      doubleTimeThresholdHours: this.doubleTimeThresholdHours,
      doubleTimeMultiplier: this.doubleTimeMultiplier,
      weekendMultiplier: this.weekendMultiplier,
      holidayMultiplier: this.holidayMultiplier,
      effectiveFromISO: this.effectiveFromISO,
      effectiveToISO: this.effectiveToISO,
      approvedBy: this.approvedBy,
      lastModifiedISO: this.lastModifiedISO,
    };
  }
}
