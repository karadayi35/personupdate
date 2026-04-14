import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp, 
  doc, 
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/firebase';
import { Shift, EmployeeShiftAssignment, ShiftOverride, AttendanceRecord } from '@/types/shifts';
import { BranchBreak, EmployeeBreakOverride } from '@/types/breaks';
import { format, parse, differenceInMinutes, startOfDay, isWithinInterval, parseISO } from 'date-fns';

export class ShiftService {
  /**
   * Finds the active shift for an employee on a specific date.
   */
  static async getActiveShiftForDate(employeeId: string, date: string): Promise<{
    startTime: string;
    endTime: string;
    breakMinutes: number;
    lateToleranceMinutes: number;
    earlyLeaveToleranceMinutes: number;
    overtimeAfterMinutes: number;
    isNightShift: boolean;
    isDayOff: boolean;
    shiftId?: string;
  } | null> {
    // 1. Check for overrides
    const overridesRef = collection(db, 'shift_overrides');
    const overrideQuery = query(
      overridesRef, 
      where('employeeId', '==', employeeId),
      where('date', '==', date)
    );
    const overrideSnap = await getDocs(overrideQuery);
    
    if (!overrideSnap.empty) {
      const override = overrideSnap.docs[0].data() as ShiftOverride;
      if (override.overrideType === 'day_off') {
        return {
          startTime: '',
          endTime: '',
          breakMinutes: 0,
          lateToleranceMinutes: 0,
          earlyLeaveToleranceMinutes: 0,
          overtimeAfterMinutes: 0,
          isNightShift: false,
          isDayOff: true
        };
      }
      
      if (override.overrideType === 'shift_change' && override.customStartTime && override.customEndTime) {
        return {
          startTime: override.customStartTime,
          endTime: override.customEndTime,
          breakMinutes: 60, // Default break or fetch from original shift if needed
          lateToleranceMinutes: 10,
          earlyLeaveToleranceMinutes: 10,
          overtimeAfterMinutes: 0,
          isNightShift: false,
          isDayOff: false
        };
      }
    }

    // 2. Check for assignments
    const assignmentsRef = collection(db, 'employee_shift_assignments');
    const assignmentQuery = query(
      assignmentsRef,
      where('employeeId', '==', employeeId),
      where('isActive', '==', true)
    );
    const assignmentSnap = await getDocs(assignmentQuery);
    
    const dayOfWeek = parseISO(date).getDay(); // 0-6
    
    for (const docSnap of assignmentSnap.docs) {
      const assignment = docSnap.data() as EmployeeShiftAssignment;
      
      const start = parseISO(assignment.startDate);
      const end = assignment.endDate ? parseISO(assignment.endDate) : new Date(2100, 0, 1);
      const current = parseISO(date);
      
      if (isWithinInterval(current, { start, end })) {
        if (assignment.activeDays.includes(dayOfWeek)) {
          // Fetch the shift template
          const shiftDoc = await getDoc(doc(db, 'shifts', assignment.shiftId));
          if (shiftDoc.exists()) {
            const shift = shiftDoc.data() as Shift;
            return {
              ...shift,
              isDayOff: false,
              shiftId: shiftDoc.id
            };
          }
        }
      }
    }

    return null; // No shift found
  }

  /**
   * Calculates attendance metrics based on check-in/out and shift details.
   */
  static calculateMetrics(
    checkIn: Date,
    checkOut: Date | null,
    shift: {
      startTime: string;
      endTime: string;
      breakMinutes: number;
      lateToleranceMinutes: number;
      earlyLeaveToleranceMinutes: number;
      overtimeAfterMinutes: number;
    }
  ) {
    const dateStr = format(checkIn, 'yyyy-MM-dd');
    const shiftStart = parse(`${dateStr} ${shift.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const shiftEnd = parse(`${dateStr} ${shift.endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    // Late Minutes
    const lateMinutes = Math.max(0, differenceInMinutes(checkIn, shiftStart) - shift.lateToleranceMinutes);

    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let workedMinutes = 0;

    if (checkOut) {
      // Early Leave
      earlyLeaveMinutes = Math.max(0, differenceInMinutes(shiftEnd, checkOut) - shift.earlyLeaveToleranceMinutes);
      
      // Overtime
      overtimeMinutes = Math.max(0, differenceInMinutes(checkOut, shiftEnd) - shift.overtimeAfterMinutes);
      
      // Worked Minutes
      workedMinutes = Math.max(0, differenceInMinutes(checkOut, checkIn) - shift.breakMinutes);
    }

    // Determine Status
    let status: AttendanceRecord['status'] = 'normal';
    if (lateMinutes > 0) status = 'late';
    if (overtimeMinutes > 60) status = 'overtime'; // Example threshold

    return {
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      workedMinutes,
      status
    };
  }

  /**
   * Calculates total break minutes for an employee on a specific date based on branch definitions and overrides.
   */
  static async calculateBreakMinutes(employeeId: string, branchId: string, shiftId: string | undefined, date: string): Promise<number> {
    try {
      // 1. Fetch branch breaks
      const branchBreaksRef = collection(db, 'branch_breaks');
      const q = query(branchBreaksRef, where('branchId', '==', branchId), where('isActive', '==', true));
      const branchBreaksSnap = await getDocs(q);
      const branchBreaks = branchBreaksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchBreak));

      if (branchBreaks.length === 0) return 0;

      // 2. Fetch employee overrides
      const overridesRef = collection(db, 'employee_break_overrides');
      const overrideQuery = query(overridesRef, where('employeeId', '==', employeeId), where('date', '==', date));
      const overrideSnap = await getDocs(overrideQuery);
      const overrides = overrideSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeBreakOverride));

      let totalMinutes = 0;

      for (const b of branchBreaks) {
        // Filter by shift if specified in the break definition
        if (b.shiftId && b.shiftId !== shiftId) continue;

        const override = overrides.find(o => o.branchBreakId === b.id);
        
        if (override) {
          if (override.isExcluded) continue;
          
          const start = override.customStartTime || b.startTime;
          const end = override.customEndTime || b.endTime;
          
          const startTime = parse(`${date} ${start}`, 'yyyy-MM-dd HH:mm', new Date());
          const endTime = parse(`${date} ${end}`, 'yyyy-MM-dd HH:mm', new Date());
          totalMinutes += Math.max(0, differenceInMinutes(endTime, startTime));
        } else {
          const startTime = parse(`${date} ${b.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
          const endTime = parse(`${date} ${b.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
          totalMinutes += Math.max(0, differenceInMinutes(endTime, startTime));
        }
      }

      return totalMinutes;
    } catch (error) {
      console.error('Error calculating break minutes:', error);
      return 0;
    }
  }

  /**
   * Recalculates an attendance record.
   */
  static async recalculateRecord(recordId: string) {
    const recordDoc = await getDoc(doc(db, 'attendance_records', recordId));
    if (!recordDoc.exists()) return;
    
    const record = recordDoc.data() as AttendanceRecord;
    const shift = await this.getActiveShiftForDate(record.employeeId, record.date);
    
    if (!shift || shift.isDayOff) {
      await updateDoc(doc(db, 'attendance_records', recordId), {
        status: shift?.isDayOff ? 'leave' : 'normal',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workedMinutes: record.checkOut ? differenceInMinutes(record.checkOut.toDate(), record.checkIn.toDate()) : 0
      });
      return;
    }

    // Calculate dynamic break minutes
    const dynamicBreakMinutes = await this.calculateBreakMinutes(
      record.employeeId, 
      record.branchId, 
      shift.shiftId, 
      record.date
    );

    const metrics = this.calculateMetrics(
      record.checkIn.toDate(),
      record.checkOut ? record.checkOut.toDate() : null,
      {
        ...shift,
        breakMinutes: dynamicBreakMinutes > 0 ? dynamicBreakMinutes : shift.breakMinutes
      }
    );

    await updateDoc(doc(db, 'attendance_records', recordId), {
      ...metrics,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Recalculates all attendance records for an employee in a specific date range.
   */
  static async recalculateForEmployeeInRange(employeeId: string, startDate: string, endDate: string) {
    const attendanceRef = collection(db, 'attendance_records');
    const q = query(
      attendanceRef,
      where('employeeId', '==', employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(doc => this.recalculateRecord(doc.id));
    await Promise.all(promises);
  }

  /**
   * Recalculates all attendance records for all employees in a specific date range.
   */
  static async recalculateAllInRange(startDate: string, endDate: string) {
    const attendanceRef = collection(db, 'attendance_records');
    const q = query(
      attendanceRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(doc => this.recalculateRecord(doc.id));
    await Promise.all(promises);
  }
}
