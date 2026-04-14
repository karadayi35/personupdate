import React from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Printer, 
  Plus, 
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  parseISO,
  getWeek,
  getYear
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Shift, EmployeeShiftAssignment, ShiftOverride } from '@/types/shifts';
import { Employee } from '@/types/employee';
import { ShiftService } from '@/services/shiftService';

export default function ShiftPlan() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [shifts, setShifts] = React.useState<Shift[]>([]);
  const [assignments, setAssignments] = React.useState<EmployeeShiftAssignment[]>([]);
  const [overrides, setOverrides] = React.useState<ShiftOverride[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [showWorkHours, setShowWorkHours] = React.useState(true);

  // Week range
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    });

    const unsubAssignments = onSnapshot(collection(db, 'employee_shift_assignments'), (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeShiftAssignment)));
    });

    const unsubOverrides = onSnapshot(
      query(
        collection(db, 'shift_overrides'),
        where('date', '>=', format(weekStart, 'yyyy-MM-dd')),
        where('date', '<=', format(weekEnd, 'yyyy-MM-dd'))
      ),
      (snapshot) => {
        setOverrides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftOverride)));
      }
    );

    setLoading(false);

    return () => {
      unsubEmployees();
      unsubShifts();
      unsubAssignments();
      unsubOverrides();
    };
  }, [currentDate]);

  const getShiftForDay = (employeeId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay(); // 0-6 (Sun-Sat)
    
    // Adjust dayOfWeek to match assignments (where 1 is Mon, 0 is Sun or similar)
    // Actually, in date-fns getDay() returns 0 for Sunday, 1 for Monday.
    // Let's assume assignments use 0 for Sunday, 1 for Monday.

    // 1. Check overrides
    const override = overrides.find(o => o.employeeId === employeeId && o.date === dateStr);
    if (override) {
      return override;
    }

    // 2. Check assignments
    const assignment = assignments.find(a => 
      a.employeeId === employeeId && 
      a.isActive && 
      a.activeDays.includes(dayOfWeek) &&
      a.startDate <= dateStr &&
      (!a.endDate || a.endDate >= dateStr)
    );

    if (assignment) {
      const shift = shifts.find(s => s.id === assignment.shiftId);
      if (shift) {
        return {
          id: `assigned_${assignment.id}`,
          employeeId,
          date: dateStr,
          customStartTime: shift.startTime,
          customEndTime: shift.endTime,
          overrideType: 'shift_change' as const
        };
      }
    }

    return null;
  };

  const toggleDayOff = async (employeeId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingOverride = overrides.find(o => o.employeeId === employeeId && o.date === dateStr);

    if (existingOverride) {
      if (existingOverride.overrideType === 'day_off') {
        // Remove day off
        await deleteDoc(doc(db, 'shift_overrides', existingOverride.id));
      } else {
        // Change to day off
        await updateDoc(doc(db, 'shift_overrides', existingOverride.id), {
          overrideType: 'day_off',
          customStartTime: null,
          customEndTime: null
        });
      }
    } else {
      // Add day off
      await addDoc(collection(db, 'shift_overrides'), {
        employeeId,
        date: dateStr,
        overrideType: 'day_off',
        createdAt: serverTimestamp()
      });
    }

    // Recalculate
    await ShiftService.recalculateForEmployeeInRange(employeeId, dateStr, dateStr);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedBranch === 'all' || emp.branchId === selectedBranch)
  );

  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });
  const year = getYear(currentDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-whatsapp-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Haftalık Vardiya / Shift Planı</h1>
          <p className="text-sm text-slate-500">Bu sayfada, haftalık planları görüntüleyerek dinamik olarak hafta tatili (OFF) tanımlayabilir ve günlük plan değişikliği yapabilirsiniz.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Week Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Hafta seçiniz</label>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 flex items-center justify-center gap-2">
                <Calendar size={16} className="text-whatsapp-600" />
                <span>{weekNumber}. Hafta ({format(weekStart, 'd MMM', { locale: tr })} - {format(weekEnd, 'd MMM yyyy', { locale: tr })})</span>
              </div>
              <button 
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Mola (dk)</label>
            <input 
              type="number" 
              defaultValue={60}
              className="w-full bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-whatsapp-500/20 focus:border-whatsapp-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Çalışma Saati</label>
            <select 
              value={showWorkHours ? 'show' : 'hide'}
              onChange={(e) => setShowWorkHours(e.target.value === 'show')}
              className="w-full bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-whatsapp-500/20 focus:border-whatsapp-500 transition-all appearance-none"
            >
              <option value="show">Göster</option>
              <option value="hide">Gizle</option>
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2">
              <RefreshCw size={18} />
              <span>Tablo oluştur</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input type="checkbox" defaultChecked className="rounded border-slate-300 text-whatsapp-600 focus:ring-whatsapp-500" />
            <span className="text-xs font-medium text-slate-600">Çalışılan gün</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-whatsapp-600 rounded-sm" />
            <span className="text-xs font-medium text-slate-600">Tatil günü / Off gün</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-400 rounded-sm" />
            <span className="text-xs font-medium text-slate-600">İzinler</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-sm" />
            <span className="text-xs font-medium text-slate-600">Resmi tatiller</span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            {weekNumber}. Hafta Vardiya Tablosu ({format(weekStart, 'd MMMM yyyy', { locale: tr })}, Pazartesi)
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Personel ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-whatsapp-500/20 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ad Soyad</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Çalışma Saati</th>
                {days.map((day) => (
                  <th key={day.toString()} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">
                    <div className="flex flex-col">
                      <span>{format(day, 'EEEE', { locale: tr })}</span>
                      <span className="text-slate-500">{format(day, 'd MMMM yyyy', { locale: tr })}</span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">Toplam Saat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-4 py-4 text-xs font-medium text-slate-500">{emp.employeeCode || '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                        {emp.name[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[10px] text-slate-500 font-medium max-w-[120px]">
                    {assignments.find(a => a.employeeId === emp.id && a.isActive)?.shiftId ? 
                      shifts.find(s => s.id === assignments.find(a => a.employeeId === emp.id && a.isActive)?.shiftId)?.name : 
                      'Atanmamış'}
                  </td>
                  {days.map((day) => {
                    const shiftInfo = getShiftForDay(emp.id, day);
                    const isDayOff = shiftInfo?.overrideType === 'day_off';
                    
                    return (
                      <td 
                        key={day.toString()} 
                        className={cn(
                          "px-2 py-3 text-center border-l border-slate-100 min-w-[120px] transition-all cursor-pointer relative group/cell",
                          isDayOff ? "bg-whatsapp-600 text-white" : "text-slate-600"
                        )}
                        onClick={() => toggleDayOff(emp.id, day)}
                      >
                        {isDayOff ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Hafta Tatili</span>
                            <span className="text-[8px] opacity-70">OFF GÜN</span>
                          </div>
                        ) : shiftInfo ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[11px] font-bold">{shiftInfo.customStartTime} - {shiftInfo.customEndTime}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <button className="p-1 hover:bg-slate-200 rounded-md text-slate-400">
                                <RefreshCw size={10} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">Plan Yok</span>
                        )}
                        
                        {/* Tooltip Simulation */}
                        {!isDayOff && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                            SADECE SEÇİLEN BİR GÜNÜN ÇALIŞMA SAATİNİ DEĞİŞTİRİN
                          </div>
                        )}
                        {isDayOff && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                            HAFTA TATİLİ (OFF GÜN) EKLEYİN VEYA SİLİN
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-center border-l border-slate-100">
                    <span className="text-xs font-bold text-slate-700">45:00</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4">
          <button className="flex items-center gap-2 bg-whatsapp-500 hover:bg-whatsapp-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-500/20">
            <Printer size={18} />
            <span>Yazdır veya PDF kaydet</span>
          </button>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20">
            <Download size={18} />
            <span>Raporu kopyala ve Excel (.xlsx) kaydet</span>
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center italic">
        Mola (dk) değeri günlük mola süresini ifade etmektedir. Girilen mola (dk) değeri, Toplam Çalışma süresinden çıkarılmaktadır.
        Toplam Saat ve Gün hesaplanırken Resmi Tatiller, Hafta Tatilleri ve İzin Günleri, toplam sürelere eklenmemektedir.
      </p>
    </div>
  );
}
