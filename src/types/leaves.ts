import { Timestamp } from 'firebase/firestore';

export interface LeaveType {
  id: string;
  name: string;
  isPaid: boolean;
  isHourly: boolean;
  color: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string; // Sicil No
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  totalDays: number;
  totalHours?: number;
  isHourly: boolean;
  shortDescription: string;
  note: string;
  documentUrl?: string;
  reflectToPayroll: boolean;
  createdBy: string; // Manager name or ID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName?: string;
  leaveTypeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  totalDays: number;
  totalHours?: number;
  note: string;
  documentUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  managerComment?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName?: string;
  year: number;
  leaveTypeName: string;
  totalAllowance: number;
  usedDays: number;
  usedHours?: number;
  remainingDays: number;
  note?: string;
  status: 'active' | 'passive';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LeaveChangeLog {
  id: string;
  leaveRecordId?: string;
  leaveBalanceId?: string;
  employeeId?: string;
  employeeName?: string;
  employeeCode?: string;
  branchName?: string;
  leaveTypeName?: string;
  actionType: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel';
  oldData?: any;
  newData?: any;
  note?: string;
  changedBy: string;
  changedAt: Timestamp;
}
