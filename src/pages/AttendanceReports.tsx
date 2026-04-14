import React from 'react';
import { 
  Calendar, 
  Download, 
  Search, 
  MapPin, 
  Smartphone, 
  QrCode,
  ArrowRight,
  RefreshCcw,
  Loader2,
  Filter,
  Printer,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import { ShiftService } from '@/services/shiftService';
import * as XLSX from 'xlsx';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  parseISO, 
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay
} from 'date-fns';
import { tr } from 'date-fns/locale';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName?: string;
  date: string; // YYYY-MM-DD
  checkIn: any;
  checkOut: any;
  workDuration: number;
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  status: string;
}

interface Employee {
  id: string;
  name: string;
  branchId: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function AttendanceReports() {
  const [records, setRecords] = React.useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetching, setFetching] = React.useState(false);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [selectedStatus, setSelectedStatus] = React.useState('active');
  const [searchTerm, setSearchTerm] = React.useState('');

  const isAdmin = auth.currentUser?.email === 'aalikirmizigul89@gmail.com';

  // Generate days for the selected month
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchData = async () => {
    setFetching(true);
    try {
      // Fetch Employees
      const empRef = collection(db, 'employees');
      const empSnap = await getDocs(empRef);
      const empData = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(empData);

      // Fetch Records for the month
      const attendanceRef = collection(db, 'attendance_records');
      const start = format(monthStart, 'yyyy-MM-dd');
      const end = format(monthEnd, 'yyyy-MM-dd');
      
      let q = query(
        attendanceRef, 
        where('date', '>=', start),
        where('date', '<=', end)
      );

      if (!isAdmin && auth.currentUser) {
        q = query(
          attendanceRef, 
          where('employeeId', '==', auth.currentUser.uid),
          where('date', '>=', start),
          where('date', '<=', end)
        );
      }

      const attendanceSnap = await getDocs(q);
      const attendanceData = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setRecords(attendanceData);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Fetch Branches initially
    const branchesRef = collection(db, 'branches');
    const unsubBranches = onSnapshot(branchesRef, (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    fetchData();

    return () => unsubBranches();
  }, [isAdmin]);

  const getRecordForDay = (employeeId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return records.find(r => r.employeeId === employeeId && r.date === dateStr);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'HH:mm');
    } catch (e) {
      return '';
    }
  };

  const exportToExcel = () => {
    // Implement monthly export logic
    const data = filteredEmployees.map(emp => {
      const row: any = { 'Sicil No': emp.employeeCode || '-', 'Ad Soyad': emp.name };
      days.forEach(day => {
        const record = getRecordForDay(emp.id, day);
        const dayStr = format(day, 'dd.MM');
        row[`${dayStr} Giriş`] = record ? formatTime(record.checkIn) : '-';
        row[`${dayStr} Çıkış`] = record ? formatTime(record.checkOut) : '-';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aylık Giriş-Çıkış");
    XLSX.writeFile(workbook, `Aylik_Rapor_${selectedMonth}.xlsx`);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || emp.branchId === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  // Month options for the dropdown
  const monthOptions = [];
  let current = new Date();
  for (let i = 0; i < 12; i++) {
    monthOptions.push({
      value: format(current, 'yyyy-MM'),
      label: format(current, 'MMMM yyyy', { locale: tr })
    });
    current = subMonths(current, 1);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[100%] mx-auto">
      {/* Title & Description */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Giriş - Çıkış Saatleri (Aylık)</h1>
        <p className="text-sm text-slate-500">Bu sayfada, belirlediğiniz parametre ve filtrelere göre "Giriş - Çıkış Saatleri (Aylık)" raporunu görüntüleyebilirsiniz.</p>
      </div>

      {/* Main Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Dönem (Ay Yıl)</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Konumlar (Son İşlemdeki)</label>
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="all">Gizle</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button 
              onClick={fetchData}
              disabled={fetching}
              className="bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {fetching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              <span>Sonuçları Getir</span>
            </button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
          <button className="flex items-center gap-2 text-emerald-600 font-bold text-sm px-4 py-2 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all">
            <Filter size={16} />
            <span>FİLTRELEME SEÇENEKLERİ</span>
          </button>

          <div className="flex-1 flex gap-3 overflow-x-auto pb-2 sm:pb-0">
            <select className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs font-bold text-slate-600 outline-none">
              <option>Tüm Çalışma Saatleri</option>
            </select>
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs font-bold text-slate-600 outline-none"
            >
              <option value="active">Aktif Durumdakiler</option>
              <option value="all">Tümü</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          {format(monthStart, 'MMMM yyyy', { locale: tr })} - Giriş - Çıkış Saatleri (Aylık)
        </h2>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Çalışmadığı günler</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-whatsapp-600 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Eksik çalışma</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-whatsapp-600 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Fazla çalışma</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-orange-400 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Hafta Tatili</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-orange-500 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">İzin ve Raporlar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-yellow-400 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Resmi Tatil</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-whatsapp-600">Hata ve Uyarı</span>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[2000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th rowSpan={3} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-20">Tarih</th>
                <th rowSpan={3} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 sticky left-24 bg-slate-50 z-20">Sicil No</th>
                <th rowSpan={3} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-40 sticky left-44 bg-slate-50 z-20">Ad Soyad</th>
                {days.map((day) => (
                  <th key={day.toString()} colSpan={2} className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">
                    <div className="flex flex-col items-center justify-center h-24">
                      <span className="rotate-180 [writing-mode:vertical-lr] whitespace-nowrap mb-1">{format(day, 'd MMMM yyyy', { locale: tr })}</span>
                      <span className="rotate-180 [writing-mode:vertical-lr] whitespace-nowrap">{format(day, 'EEEE', { locale: tr })}</span>
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {days.map((day) => (
                  <React.Fragment key={`sub-${day.toString()}`}>
                    <th className="px-1 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100 w-12">Giriş</th>
                    <th className="px-1 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center w-12">Çıkış</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading || fetching ? (
                <tr>
                  <td colSpan={days.length * 2 + 3} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Loader2 className="animate-spin text-whatsapp-600" size={32} />
                      <span className="font-medium">Veriler hazırlanıyor...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={days.length * 2 + 3} className="px-6 py-20 text-center text-slate-400 italic">
                    Personel bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-4 text-[10px] font-medium text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100"></td>
                    <td className="px-4 py-4 text-[10px] font-medium text-slate-500 sticky left-24 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">{emp.employeeCode || '-'}</td>
                    <td className="px-4 py-4 text-[10px] font-bold text-slate-700 sticky left-44 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">{emp.name}</td>
                    {days.map((day) => {
                      const record = getRecordForDay(emp.id, day);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      
                      return (
                        <React.Fragment key={`cell-${emp.id}-${day.toString()}`}>
                          <td className={cn(
                            "px-1 py-4 text-[10px] text-center border-l border-slate-100",
                            isWeekend ? "bg-orange-400/20" : "",
                            record?.status === 'late' ? "text-whatsapp-600 font-bold" : "text-slate-600"
                          )}>
                            {record ? formatTime(record.checkIn) : ''}
                          </td>
                          <td className={cn(
                            "px-1 py-4 text-[10px] text-center",
                            isWeekend ? "bg-orange-400/20" : "",
                            record?.status === 'early-exit' ? "text-whatsapp-600 font-bold" : "text-slate-600"
                          )}>
                            {record ? formatTime(record.checkOut) : ''}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col items-center gap-6">
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notlar:</p>
            <p className="text-[10px] text-slate-400 italic max-w-4xl">
              Sadece gün içindeki <span className="underline">İlk Giriş</span> ve <span className="underline">Son Çıkış</span> işlemleri hesaba katılmaktadır. Gün içindeki diğer işlemler hesaplamalarda dikkate alınmamaktadır.
              Tüm raporlar, sistemimizi kullanan firmaların tamamının ortak ve genel ihtiyaçlarına yönelik hazırlanmakta ve sonuç vermektedir. İlgili verilerin doğruluğunu, en az bir defa olmak kaydıyla mali müşaviriniz ile değerlendirerek kullanmanızı öneririz.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="flex items-center gap-2 bg-whatsapp-500 hover:bg-whatsapp-600 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-500/20">
              <Printer size={18} />
              <span>Yazdır veya PDF kaydet</span>
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
            >
              <Download size={18} />
              <span>Raporu kopyala ve Excel (.xlsx) kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
