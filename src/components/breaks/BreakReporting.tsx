import React from 'react';
import { 
  Search, 
  Printer, 
  FileDown, 
  FileSpreadsheet,
  Loader2,
  Clock,
  User,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  TrendingUp,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  getDocs
} from 'firebase/firestore';
import { BreakRecord, BreakReport, BranchBreak, EmployeeBreakOverride } from '@/types/breaks';
import { ShiftService } from '@/services/shiftService';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, parse, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  branchId: string;
}

interface Branch {
  id: string;
  name: string;
}

export default function BreakReporting() {
  const [records, setRecords] = React.useState<BreakRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [branchBreaks, setBranchBreaks] = React.useState<BranchBreak[]>([]);
  const [overrides, setOverrides] = React.useState<EmployeeBreakOverride[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Table states
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const unsubBranchBreaks = onSnapshot(collection(db, 'branch_breaks'), (snap) => {
      setBranchBreaks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchBreak)));
    });

    const unsubOverrides = onSnapshot(collection(db, 'employee_break_overrides'), (snap) => {
      setOverrides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeBreakOverride)));
    });

    const q = query(
      collection(db, 'break_records'), 
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const unsubRecords = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakRecord)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'break_records');
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubBranches();
      unsubBranchBreaks();
      unsubOverrides();
      unsubRecords();
    };
  }, [startDate, endDate]);

  const reports: BreakReport[] = React.useMemo(() => {
    const reportMap = new Map<string, BreakReport>();

    // 1. Initialize report map with all employees for each day in range if needed, 
    // or just based on records. Let's stick to records for now but add scheduled info.
    
    records.forEach(r => {
      const key = `${r.employeeId}_${r.date}`;
      const existing = reportMap.get(key);

      if (existing) {
        existing.totalBreakTime += r.totalMinutes || 0;
        existing.breakCount += 1;
        existing.details.push(r);
      } else {
        // Calculate scheduled time for this employee/date
        const employee = employees.find(e => e.id === r.employeeId);
        let scheduledMinutes = 0;
        
        if (employee) {
          const empBranchBreaks = branchBreaks.filter(b => b.branchId === employee.branchId && b.isActive);
          const empOverrides = overrides.filter(o => o.employeeId === r.employeeId && o.date === r.date);
          
          empBranchBreaks.forEach(b => {
            const override = empOverrides.find(o => o.branchBreakId === b.id);
            if (override) {
              if (!override.isExcluded) {
                const start = override.customStartTime || b.startTime;
                const end = override.customEndTime || b.endTime;
                const startTime = parse(`${r.date} ${start}`, 'yyyy-MM-dd HH:mm', new Date());
                const endTime = parse(`${r.date} ${end}`, 'yyyy-MM-dd HH:mm', new Date());
                scheduledMinutes += Math.max(0, differenceInMinutes(endTime, startTime));
              }
            } else {
              const startTime = parse(`${r.date} ${b.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
              const endTime = parse(`${r.date} ${b.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
              scheduledMinutes += Math.max(0, differenceInMinutes(endTime, startTime));
            }
          });
        }

        reportMap.set(key, {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          employeeCode: r.employeeCode,
          branchName: r.branchName,
          date: r.date,
          totalBreakTime: r.totalMinutes || 0,
          scheduledBreakTime: scheduledMinutes,
          breakCount: 1,
          details: [r]
        });
      }
    });

    return Array.from(reportMap.values());
  }, [records, employees, branchBreaks, overrides]);

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || r.branchName === selectedBranch;
    
    return matchesSearch && matchesBranch;
  });

  const paginatedReports = filteredReports.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredReports.length / pageSize);

  const handleExportExcel = () => {
    const data = filteredReports.map(r => ({
      'Sicil No': r.employeeCode,
      'Personel': r.employeeName,
      'Şube': r.branchName,
      'Tarih': format(parseISO(r.date), 'dd.MM.yyyy'),
      'Mola Sayısı': r.breakCount,
      'Toplam Mola Süresi (dk)': r.totalBreakTime
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mola Raporu");
    XLSX.writeFile(wb, `Mola_Raporu_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Mola Raporlama Sistemi', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih Aralığı: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 30);

    const tableData = filteredReports.map((r, i) => [
      i + 1,
      r.employeeCode,
      r.employeeName,
      r.branchName,
      format(parseISO(r.date), 'dd.MM.yyyy'),
      r.breakCount,
      `${r.totalBreakTime} dk`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Tarih', 'Mola Sayısı', 'Toplam Süre']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 }
    });

    doc.save(`Mola_Raporu_${startDate}_${endDate}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center shrink-0">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Mola Sayısı</p>
            <p className="text-2xl font-black text-slate-800">{records.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Mola Süresi</p>
            <p className="text-2xl font-black text-slate-800">
              {records.reduce((acc, r) => acc + (r.totalMinutes || 0), 0)} dk
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ortalama Mola Süresi</p>
            <p className="text-2xl font-black text-slate-800">
              {records.length > 0 
                ? Math.round(records.reduce((acc, r) => acc + (r.totalMinutes || 0), 0) / records.length) 
                : 0} dk
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end no-print">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel / Sicil No</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Arama..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Şube</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="Tüm Şubeler">Tüm Şubeler</option>
            {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Başlangıç Tarihi</label>
          <input 
            type="date"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bitiş Tarihi</label>
          <input 
            type="date"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet size={18} />
            <span>Excel</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
          >
            <FileDown size={18} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Mola Sayısı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Planlanan</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Gerçekleşen</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Fark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedReports.map((r, i) => {
                const diff = (r.totalBreakTime || 0) - (r.scheduledBreakTime || 0);
                return (
                  <tr key={`${r.employeeId}_${r.date}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{r.employeeCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{r.employeeName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{r.branchName}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {format(parseISO(r.date), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                        {r.breakCount} Mola
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-600">
                        {r.scheduledBreakTime || 0} dk
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-black text-whatsapp-600">
                        {r.totalBreakTime} dk
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "text-sm font-bold",
                        diff > 0 ? "text-amber-600" : diff < 0 ? "text-emerald-600" : "text-slate-400"
                      )}>
                        {diff > 0 ? `+${diff}` : diff} dk
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paginatedReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                    Rapor verisi bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between no-print">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Toplam {filteredReports.length} Kayıt
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-slate-600 px-4">
              Sayfa {currentPage} / {totalPages || 1}
            </span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
