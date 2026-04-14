import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Calendar,
  Building2,
  User,
  Clock,
  Briefcase,
  DollarSign,
  TrendingUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  parseISO, 
  differenceInMinutes,
  isWeekend,
  getDay,
  subMonths
} from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface DailyData {
  date: string;
  checkIn: string;
  checkOut: string;
  status: string; // RT, Yİ, MZ, R, HT, Üİ, DZ, ?
  workedMinutes: number;
  isWeekend: boolean;
}

interface PayrollRecord {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  daily: { [key: string]: DailyData };
  
  // Summary Stats - Duration (Minutes)
  expectedTC: number;
  expectedNM: number;
  calculatedTC: number;
  calculatedNM: number;
  calculatedFM: number;
  calculatedFMRT: number;
  calculatedEM: number;
  calculatedDZ: number;
  calculatedHT: number;
  calculatedRT: number;
  calculatedYI: number;
  calculatedMZ: number;
  calculatedR: number;

  // Summary Stats - Days
  expectedCG: number;
  expectedTCDays: number;
  expectedNMDays: number;
  calculatedTCDays: number;
  calculatedNMDays: number;
  calculatedDZDays: number;
  calculatedHTDays: number;
  calculatedRTDays: number;
  calculatedYIDays: number;
  calculatedMZDays: number;
  calculatedUIDays: number;
  calculatedRDays: number;
}

export default function PayrollReport() {
  const [payrollData, setPayrollData] = React.useState<PayrollRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetching, setFetching] = React.useState(false);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));
  const [dailyWorkHours, setDailyWorkHours] = React.useState('9');
  const [breakMinutes, setBreakMinutes] = React.useState(60);
  const [lateTolerance, setLateTolerance] = React.useState(5);
  const [earlyExitTolerance, setEarlyExitTolerance] = React.useState(0);
  
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = React.useState('active');

  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchData = async () => {
    setFetching(true);
    try {
      // Fetch Branches
      const branchSnap = await getDocs(collection(db, 'branches'));
      setBranches(branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Employees
      const empSnap = await getDocs(collection(db, 'employees'));
      const employees = empSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(emp => selectedStatus === 'all' || emp.status === selectedStatus);

      // Fetch Attendance Records
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      const attendanceSnap = await getDocs(query(
        collection(db, 'attendance_records'),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      ));
      const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());

      // Fetch Leave Records
      const leaveSnap = await getDocs(query(
        collection(db, 'leave_records'),
        where('startDate', '>=', startStr),
        where('startDate', '<=', endStr)
      ));
      const leaveRecords = leaveSnap.docs.map(doc => doc.data());

      // Process Data
      const processedData: PayrollRecord[] = employees.map((emp: any) => {
        const empAttendance = attendanceRecords.filter(r => r.employeeId === emp.id);
        const empLeaves = leaveRecords.filter(r => r.employeeId === emp.id);
        
        const daily: { [key: string]: DailyData } = {};
        
        let totalWorkedMinutes = 0;
        let totalLateMinutes = 0;
        let totalEarlyExitMinutes = 0;
        let totalOvertimeMinutes = 0;
        
        let workedDays = 0;
        let leaveDays = 0;
        let weekendDays = 0;
        let holidayDays = 0;
        let absentDays = 0;

        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const record = empAttendance.find(r => r.date === dateStr);
          const leave = empLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
          const isDayWeekend = isWeekend(day);

          let status = '';
          if (leave) {
            status = leave.leaveType === 'Yıllık İzin' ? 'Yİ' : 
                     leave.leaveType === 'Mazeret İzni' ? 'MZ' : 
                     leave.leaveType === 'Hastalık İzni' ? 'R' : 
                     leave.leaveType === 'Ücretsiz İzin' ? 'Üİ' : 'İ';
          } else if (isDayWeekend) {
            status = 'HT';
          } else if (record) {
            status = record.checkOut ? '' : '?'; // Normal work days show times, not 'RT' unless it's a holiday
          } else {
            status = 'DZ';
          }

          daily[dateStr] = {
            date: dateStr,
            checkIn: record?.checkIn ? format(record.checkIn.toDate(), 'HH:mm') : '',
            checkOut: record?.checkOut ? format(record.checkOut.toDate(), 'HH:mm') : '',
            status,
            workedMinutes: record?.workedMinutes || 0,
            isWeekend: isDayWeekend
          };

          if (status === 'RT') workedDays++;
          if (['Yİ', 'MZ', 'R', 'İ'].includes(status)) leaveDays++;
          if (status === 'HT') weekendDays++;
          if (status === 'DZ') absentDays++;
          
          totalWorkedMinutes += record?.workedMinutes || 0;
        });

        const dailyTargetMinutes = parseInt(dailyWorkHours) * 60;
        const expectedTCDays = days.filter(d => !isWeekend(d)).length;

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.employeeCode || `00000${emp.id.slice(0, 2)}`,
          branchName: emp.branchName || 'Merkez',
          daily,
          
          expectedTC: expectedTCDays * dailyTargetMinutes,
          expectedNM: expectedTCDays * dailyTargetMinutes,
          calculatedTC: totalWorkedMinutes,
          calculatedNM: Math.min(totalWorkedMinutes, expectedTCDays * dailyTargetMinutes),
          calculatedFM: Math.max(0, totalWorkedMinutes - expectedTCDays * dailyTargetMinutes),
          calculatedFMRT: 0,
          calculatedEM: Math.max(0, expectedTCDays * dailyTargetMinutes - totalWorkedMinutes),
          calculatedDZ: absentDays * dailyTargetMinutes,
          calculatedHT: weekendDays * dailyTargetMinutes,
          calculatedRT: workedDays * dailyTargetMinutes,
          calculatedYI: leaveDays * dailyTargetMinutes,
          calculatedMZ: 0,
          calculatedR: 0,

          expectedCG: days.length,
          expectedTCDays,
          expectedNMDays: expectedTCDays,
          calculatedTCDays: workedDays,
          calculatedNMDays: workedDays,
          calculatedDZDays: absentDays,
          calculatedHTDays: weekendDays,
          calculatedRTDays: 0,
          calculatedYIDays: leaveDays,
          calculatedMZDays: 0,
          calculatedUIDays: 0,
          calculatedRDays: 0,
        };
      });

      setPayrollData(processedData);
    } catch (error) {
      console.error('Payroll fetch error:', error);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const filteredData = payrollData.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || r.branchName === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return '0,00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h},${m.toString().padStart(2, '0')}`;
  };

  const handleExportExcel = () => {
    const header1 = ["Kullanıcı Bilgileri", "", format(monthStart, 'MMMM yyyy', { locale: tr }), ...Array(days.length - 1).fill(""), "Beklenen Süre", "", "Hesaplanan Süre", ...Array(10).fill(""), "Beklenen Gün", "", "", "Hesaplanan Gün", ...Array(8).fill(""), "İmza"];
    const header2 = ["Sicil No", "Ad Soyad", ...days.map(d => format(d, 'd')), "TÇ", "NM", "TÇ", "NM", "FM", "FM (RT)", "EM", "DZ", "HT", "RT", "Yİ", "MZ", "R", "ÇG", "TÇ", "NM", "TÇ", "NM", "DZ", "HT", "RT", "Yİ", "MZ", "Üİ", "R", ""];
    
    const data = filteredData.map(emp => [
      emp.employeeCode,
      emp.employeeName,
      ...days.map(day => {
        const d = emp.daily[format(day, 'yyyy-MM-dd')];
        return d.status || (d.checkIn ? `${d.checkIn}-${d.checkOut}` : "");
      }),
      formatMinutes(emp.expectedTC),
      formatMinutes(emp.expectedNM),
      formatMinutes(emp.calculatedTC),
      formatMinutes(emp.calculatedNM),
      formatMinutes(emp.calculatedFM),
      formatMinutes(emp.calculatedFMRT),
      formatMinutes(emp.calculatedEM),
      formatMinutes(emp.calculatedDZ),
      formatMinutes(emp.calculatedHT),
      formatMinutes(emp.calculatedRT),
      formatMinutes(emp.calculatedYI),
      formatMinutes(emp.calculatedMZ),
      formatMinutes(emp.calculatedR),
      emp.expectedCG,
      emp.expectedTCDays,
      emp.expectedNMDays,
      emp.calculatedTCDays,
      emp.calculatedNMDays,
      emp.calculatedDZDays,
      emp.calculatedHTDays,
      emp.calculatedRTDays,
      emp.calculatedYIDays,
      emp.calculatedMZDays,
      emp.calculatedUIDays,
      emp.calculatedRDays,
      ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Puantaj Raporu");
    XLSX.writeFile(wb, `Puantaj_Raporu_${selectedMonth}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a2'); // Use large format for wide table
    doc.setFontSize(20);
    doc.text(`${format(monthStart, 'MMMM yyyy', { locale: tr })} Puantaj Raporu`, 40, 40);
    
    const tableData = filteredData.map(emp => [
      emp.employeeCode,
      emp.employeeName,
      ...days.map(day => emp.daily[format(day, 'yyyy-MM-dd')].status || ""),
      formatMinutes(emp.calculatedTC),
      formatMinutes(emp.calculatedNM),
      formatMinutes(emp.calculatedFM),
      emp.calculatedTCDays,
      emp.calculatedDZDays
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Sicil', 'Ad Soyad', ...days.map(d => format(d, 'd')), 'TÇ', 'NM', 'FM', 'TÇ Gün', 'DZ Gün']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [225, 29, 72] }
    });

    doc.save(`Puantaj_Raporu_${selectedMonth}.pdf`);
  };

  const monthOptions = [];
  let current = new Date();
  for (let i = 0; i < 12; i++) {
    monthOptions.push({
      value: format(current, 'yyyy-MM'),
      label: format(current, 'MMMM yyyy', { locale: tr })
    });
    current = subMonths(current, 1);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RT': return 'bg-emerald-500/20 text-emerald-700';
      case 'Yİ': return 'bg-emerald-600/30 text-emerald-800';
      case 'MZ': return 'bg-emerald-400/20 text-emerald-600';
      case 'R': return 'bg-emerald-300/20 text-emerald-500';
      case 'HT': return 'bg-amber-400/30 text-amber-800';
      case 'Üİ': return 'bg-whatsapp-500/20 text-whatsapp-700';
      case 'DZ': return 'bg-whatsapp-600/30 text-whatsapp-800';
      case '?': return 'bg-whatsapp-700 text-white';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[100%] mx-auto">
      {/* Title & Description */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Puantaj (Detaylı Görünüm)</h1>
        <p className="text-sm text-slate-500">Bu sayfada, belirlediğiniz parametre ve filtrelere göre "Puantaj (Detaylı Görünüm)" raporunu görüntüleyebilirsiniz.</p>
      </div>

      {/* Main Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
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
            <label className="text-xs font-bold text-slate-500 ml-1">Günlük çalışma süresi</label>
            <select 
              value={dailyWorkHours}
              onChange={(e) => setDailyWorkHours(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="8">8 saat</option>
              <option value="9">9 saat</option>
              <option value="10">10 saat</option>
              <option value="12">12 saat</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Yemek + Mola süresi (dk)</label>
            <input 
              type="number"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Geç kalma toleransı (dk)</label>
            <input 
              type="number"
              value={lateTolerance}
              onChange={(e) => setLateTolerance(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Erken çıkma toleransı (dk)</label>
            <input 
              type="number"
              value={earlyExitTolerance}
              onChange={(e) => setEarlyExitTolerance(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>

          <div className="flex justify-end">
            <button 
              onClick={fetchData}
              disabled={fetching}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold px-4 py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
          {format(monthStart, 'MMMM yyyy', { locale: tr })} - Puantaj (Detaylı Görünüm)
        </h2>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-emerald-500/20 border border-emerald-200 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Ücretli İzinler (Tam gün çalışma kabul edilir)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-whatsapp-500/20 border border-whatsapp-200 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Ücretsiz İzinler (Çalışma günü kabul edilmez)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-400/30 border border-amber-200 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Hafta sonu (Çalışma olmayan gün)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-whatsapp-700 rounded-sm" />
            <span className="text-[10px] font-medium text-slate-500">Hata ve Uyarı</span>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[3000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th colSpan={2} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-64 sticky left-0 bg-slate-50 z-30 text-center">Kullanıcı Bilgileri</th>
                <th colSpan={days.length} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">{format(monthStart, 'MMMM yyyy', { locale: tr })}</th>
                <th colSpan={2} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">Beklenen Süre</th>
                <th colSpan={11} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">Hesaplanan Süre</th>
                <th colSpan={3} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">Beklenen Gün</th>
                <th colSpan={9} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100">Hesaplanan Gün</th>
                <th rowSpan={3} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-l border-slate-100 w-20">İmza</th>
              </tr>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th rowSpan={2} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24 sticky left-0 bg-slate-50 z-30">Sicil No</th>
                <th rowSpan={2} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-40 sticky left-24 bg-slate-50 z-30 border-r border-slate-100">Ad Soyad</th>
                {days.map((day) => (
                  <th key={day.toString()} className="px-1 py-2 text-[10px] font-bold text-slate-400 text-center border-l border-slate-100 w-12">{format(day, 'd')}</th>
                ))}
                
                {/* Beklenen Süre */}
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center border-l border-slate-100 w-12">TÇ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">NM</th>

                {/* Hesaplanan Süre */}
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center border-l border-slate-100 w-12">TÇ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">NM</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">FM</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">FM (RT)</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">EM</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">DZ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">HT</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">RT</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">Yİ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">MZ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">R</th>

                {/* Beklenen Gün */}
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center border-l border-slate-100 w-12">ÇG</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">TÇ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">NM</th>

                {/* Hesaplanan Gün */}
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center border-l border-slate-100 w-12">TÇ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">NM</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">DZ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">HT</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">RT</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">Yİ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">MZ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">Üİ</th>
                <th className="px-1 py-3 text-[9px] font-bold text-slate-400 text-center w-12">R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading || fetching ? (
                <tr>
                  <td colSpan={days.length + 30} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Loader2 className="animate-spin text-whatsapp-600" size={32} />
                      <span className="font-medium">Veriler hazırlanıyor...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 30} className="px-6 py-20 text-center text-slate-400 italic">
                    Personel bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredData.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-4 text-[10px] font-medium text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50 z-20 border-r border-slate-100">{emp.employeeCode}</td>
                    <td className="px-4 py-4 text-[10px] font-bold text-slate-700 sticky left-24 bg-white group-hover:bg-slate-50 z-20 border-r border-slate-100">{emp.employeeName}</td>
                    
                    {days.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const d = emp.daily[dateStr];
                      return (
                        <td key={dateStr} className={cn(
                          "px-1 py-4 text-[9px] text-center border-l border-slate-100 font-bold",
                          getStatusColor(d.status)
                        )}>
                          <div className="flex flex-col items-center">
                            <span>{d.status}</span>
                            {d.checkIn && <span className="text-[7px] font-normal opacity-70">{d.checkIn} {d.checkOut}</span>}
                          </div>
                        </td>
                      );
                    })}

                    {/* Beklenen Süre */}
                    <td className="px-1 py-4 text-[9px] text-center border-l border-slate-100 font-bold text-slate-600">{formatMinutes(emp.expectedTC)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{formatMinutes(emp.expectedNM)}</td>

                    {/* Hesaplanan Süre */}
                    <td className="px-1 py-4 text-[9px] text-center border-l border-slate-100 font-bold text-slate-900">{formatMinutes(emp.calculatedTC)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-900">{formatMinutes(emp.calculatedNM)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-emerald-600">{formatMinutes(emp.calculatedFM)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-emerald-600">{formatMinutes(emp.calculatedFMRT)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-600">{formatMinutes(emp.calculatedEM)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-600">{formatMinutes(emp.calculatedDZ)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-amber-600">{formatMinutes(emp.calculatedHT)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-600">{formatMinutes(emp.calculatedRT)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-emerald-700">{formatMinutes(emp.calculatedYI)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{formatMinutes(emp.calculatedMZ)}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{formatMinutes(emp.calculatedR)}</td>

                    {/* Beklenen Gün */}
                    <td className="px-1 py-4 text-[9px] text-center border-l border-slate-100 font-bold text-slate-600">{emp.expectedCG}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{emp.expectedTCDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{emp.expectedNMDays}</td>

                    {/* Hesaplanan Gün */}
                    <td className="px-1 py-4 text-[9px] text-center border-l border-slate-100 font-bold text-slate-900">{emp.calculatedTCDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-900">{emp.calculatedNMDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-600">{emp.calculatedDZDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-amber-600">{emp.calculatedHTDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-600">{emp.calculatedRTDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-emerald-700">{emp.calculatedYIDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{emp.calculatedMZDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-whatsapp-700">{emp.calculatedUIDays}</td>
                    <td className="px-1 py-4 text-[9px] text-center font-bold text-slate-600">{emp.calculatedRDays}</td>
                    
                    <td className="px-1 py-4 border-l border-slate-100"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Legends Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
        {/* Devamsızlık Türü */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Devamsızlık Türü / Kodu</h3>
          <div className="space-y-2">
            {[
              { label: 'Resmi Tatil', code: 'RT', color: 'bg-emerald-500/20 text-emerald-700' },
              { label: 'Yıllık İzin', code: 'Yİ', color: 'bg-emerald-600/30 text-emerald-800' },
              { label: 'Mazeret ve Diğer İz.', code: 'MZ', color: 'bg-emerald-400/20 text-emerald-600' },
              { label: 'Raporlu', code: 'R', color: 'bg-emerald-300/20 text-emerald-500' },
              { label: 'Hafta Tatili', code: 'HT', color: 'bg-amber-400/30 text-amber-800' },
              { label: 'Ücretsiz İzin', code: 'Üİ', color: 'bg-whatsapp-500/20 text-whatsapp-700' },
              { label: 'Devamsız', code: 'DZ', color: 'bg-whatsapp-600/30 text-whatsapp-800' },
              { label: 'Hata (çıkış yok / max limit)', code: '?', color: 'bg-whatsapp-700 text-white' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{item.label}</span>
                <span className={cn("w-8 h-5 flex items-center justify-center rounded font-bold", item.color)}>{item.code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Renk / Hesaplamada Yeri */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Renk / Hesaplamada yeri</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-700">Ücretli İzinler</p>
                <p className="text-[10px] text-slate-500 leading-tight">Bu renk ile belirtilen günler, tam gün çalışma kabul edilir ve <span className="underline">toplam çalışmaya eklenir.</span></p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/30 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-700">Hafta Tatilleri</p>
                <p className="text-[10px] text-slate-500 leading-tight">Bu renk ile belirtilen günler, çalışma olmayan (off) gündür ve <span className="underline">toplam çalışmaya eklenmez.</span></p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-lg bg-whatsapp-500/20 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-700">Ücretsiz İzinler</p>
                <p className="text-[10px] text-slate-500 leading-tight">Bu renk ile belirtilen günler, çalışma günü kabul edilmez ve <span className="underline">toplam çalışmaya eklenmez.</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Hesaplama Kısaltmaları */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Hesaplama Kısaltmaları</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { code: 'TÇ', label: 'Toplam Çalışma' },
              { code: 'NM', label: 'Normal Mesai' },
              { code: 'FM', label: 'Fazla Mesai' },
              { code: 'EM', label: 'Eksik Mesai' },
              { code: 'DZ', label: 'Devamsız' },
              { code: 'HT', label: 'Hafta Tatili' },
              { code: 'RT', label: 'Resmi Tatil' },
              { code: 'Yİ', label: 'Yıllık İzin' },
              { code: 'MZ', label: 'Mazeret ve Diğer' },
              { code: 'R', label: 'Raporlu' },
              { code: 'ÇG', label: 'Çalışma Günü' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="font-bold text-slate-800 w-8">{item.code}</span>
                <span className="text-slate-500 whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Önemli Açıklamalar */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Önemli Açıklamalar</h3>
          <div className="space-y-2 text-[10px] text-slate-500 leading-relaxed italic">
            <p>Tüm süre hesaplamaları, çarpma ve bölme kolaylığınız için <span className="font-bold text-slate-700">tam sayı</span> olarak gösterilir. Ör: 84,30 olarak gösterilen değer, süre olarak 84:30 saat:dakika olmaktadır.</p>
            <p><span className="font-bold text-slate-700">FM (Fazla Mesai):</span> "Hesaplanan NM" süresinin, "Beklenen NM"den fazla olan kısmıdır. Haftalık 45 saat aranmaz.</p>
            <p><span className="font-bold text-slate-700">EM (Eksik Mesai):</span> "Hesaplanan NM" süresinin, "Beklenen NM"den eksik kalan kısmıdır.</p>
            <p>Sadece gün içindeki <span className="underline">İlk Giriş</span> ve <span className="underline">Son Çıkış</span> işlemleri listelenmektedir.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 no-print pb-10">
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-600/20">
          <Printer size={18} />
          <span>Yazdır veya PDF kaydet</span>
        </button>
        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20">
          <Download size={18} />
          <span>Excel (.xlsx) Olarak İndir</span>
        </button>
      </div>
    </div>
  );
}
