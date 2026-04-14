import { Timestamp } from 'firebase/firestore';

export interface BreakRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  totalMinutes?: number;
  type: 'Çay Molası' | 'Yemek Molası' | 'İhtiyaç Molası' | 'Diğer';
  status: 'active' | 'completed' | 'error';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface BreakReport {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  date: string;
  totalBreakTime: number; // in minutes
  scheduledBreakTime?: number; // in minutes
  breakCount: number;
  details: BreakRecord[];
}

export interface BranchBreak {
  id: string;
  branchId: string;
  shiftId?: string;
  type: 'Çay Molası' | 'Yemek Molası';
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
}

export interface EmployeeBreakOverride {
  id: string;
  employeeId: string;
  branchBreakId: string;
  date: string; // YYYY-MM-DD
  customStartTime?: string; // HH:mm
  customEndTime?: string; // HH:mm
  isExcluded: boolean;
}
