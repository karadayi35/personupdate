import { Timestamp } from 'firebase/firestore';

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  overtimeAfterMinutes: number;
  isNightShift: boolean;
  activeDays: number[]; // Default active days for this template (0-6)
}

export interface EmployeeShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  repeatType: 'daily' | 'weekly' | 'custom';
  activeDays: number[]; // 0-6
  isActive: boolean;
}

export interface ShiftOverride {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  customStartTime?: string;
  customEndTime?: string;
  overrideType: 'shift_change' | 'day_off' | 'overtime' | 'replacement';
  reason?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  checkIn: Timestamp;
  checkOut?: Timestamp;
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  location?: {
    lat: number;
    lng: number;
    address: string;
    isWithinRadius: boolean;
  };
  method: 'QR' | 'Manual' | 'NFC';
  status: 'normal' | 'late' | 'absent' | 'leave' | 'overtime';
  deviceInfo?: string;
}
