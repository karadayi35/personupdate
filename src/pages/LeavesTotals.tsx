import React from 'react';
import { 
  Search, 
  Building2, 
  Calendar, 
  Filter, 
  Printer, 
  FileDown, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { LeaveRecord, LeaveBalance } from '@/types/leaves';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface LeaveSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  annualAllowance: number;
  annualUsed: number;
  annualRemaining: number;
  paidTotal: number;
  unpaidTotal: number;
  sickTotal: number;
  hourlyTotal: number;
  totalDays: number;
}

const LEAVE_TYPES = [
  'Tümünde',
  'Yıllık İzin',
  'Ücretli İzin',
  'Ücretsiz İzin',
  'Raporlu',
  'Babalık İzni',
  'Doğum İzni',
  'Mazeret ve Diğer Ücretli İzinler',
  'Saatlik İzin'
];

export default function LeavesTotals() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [balances, setBalances] = React.useState<LeaveBalance[]>([]);
  const [leaves, setLeaves] = React.useState<LeaveRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());
  const [selectedLeaveType, setSelectedLeaveType] = React.useState('Tümünde');
  
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const employeesRef = collection(db, 'employees');
    const branchesRef = collection(db, 'branches');
    const balancesRef = collection(db, 'leave_balances');
    const leavesRef = collection(db, 'leave_records');

    const unsubEmployees = onSnapshot(employeesRef, (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const unsubBranches = onSnapshot(branchesRef, (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const unsubBalances = onSnapshot(query(balancesRef, where('year', '==', parseInt(selectedYear))), (snap) => {
      setBalances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveBalance)));
    });

    const unsubLeaves = onSnapshot(leavesRef, (snap) => {
      setLeaves(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord)));
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubBranches();
      unsubBalances();
      unsubLeaves();
    };
  }, [selectedYear]);

  const summaries: LeaveSummary[] = React.useMemo(() => {
    return employees.map(emp => {
      const branch = branches.find(b => b.id === emp.branchId);
      const balance = balances.find(b => b.employeeId === emp.id);
      
      const empLeaves = leaves.filter(l => 
        l.employeeId === emp.id && 
        l.status === 'approved' &&
        l.startDate.startsWith(selectedYear)
      );

      const paidTotal = empLeaves
        .filter(l => l.leaveTypeName === 'Ücretli İzin' || l.leaveTypeName === 'Babalık İzni' || l.leaveTypeName === 'Doğum İzni' || l.leaveTypeName === 'Mazeret ve Diğer Ücretli İzinler')
        .reduce((sum, l) => sum + l.totalDays, 0);
      
      const unpaidTotal = empLeaves
        .filter(l => l.leaveTypeName === 'Ücretsiz İzin')
        .reduce((sum, l) => sum + l.totalDays, 0);
      
      const sickTotal = empLeaves
        .filter(l => l.leaveTypeName === 'Raporlu')
        .reduce((sum, l) => sum + l.totalDays, 0);
      
      const hourlyTotal = empLeaves
        .filter(l => l.leaveTypeName === 'Saatlik İzin')
        .reduce((sum, l) => sum + (l.totalHours || 0), 0);

      const totalDays = empLeaves.reduce((sum, l) => sum + l.totalDays, 0);

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        branchName: branch?.name || 'Bilinmiyor',
        annualAllowance: balance?.totalAllowance || 0,
        annualUsed: balance?.usedDays || 0,
        annualRemaining: balance?.remainingDays || 0,
        paidTotal,
        unpaidTotal,
        sickTotal,
        hourlyTotal,
        totalDays
      };
    });
  }, [employees, branches, balances, leaves, selectedYear]);

  const filteredSummaries = summaries.filter(s => {
    const matchesSearch = 
      s.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || s.branchName === selectedBranch;
    
    // Type filter is a bit tricky here because we show all totals. 
    // If a type is selected, we might want to only show employees who have that type of leave?
    // Or maybe just highlight it? The request says "izin türü filtresi".
    // Let's assume it filters the list to only those who have used that type of leave.
    let matchesType = true;
    if (selectedLeaveType !== 'Tümünde') {
      if (selectedLeaveType === 'Yıllık İzin') matchesType = s.annualUsed > 0;
      else if (selectedLeaveType === 'Ücretli İzin') matchesType = s.paidTotal > 0;
      else if (selectedLeaveType === 'Ücretsiz İzin') matchesType = s.unpaidTotal > 0;
      else if (selectedLeaveType === 'Raporlu') matchesType = s.sickTotal > 0;
      else if (selectedLeaveType === 'Saatlik İzin') matchesType = s.hourlyTotal > 0;
    }

    return matchesSearch && matchesBranch && matchesType;
  });

  const paginatedSummaries = filteredSummaries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredSummaries.length / pageSize);

  const handlePrint = () => {
    setIsPrintMenuOpen(false);
    setTimeout(() => {
      window.focus();
      window.print();
    }, 150);
  };

  const handleDownloadPDF = () => {
    setIsPrintMenuOpen(false);
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.text('Patron İzin Toplamları Raporu', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);
    doc.text(`Yıl: ${selectedYear} | Şube: ${selectedBranch} | Filtre: ${selectedLeaveType}`, 14, 36);

    const tableData = filteredSummaries.map((s, index) => [
      index + 1,
      s.employeeCode,
      s.employeeName,
      s.branchName,
      s.annualAllowance,
      s.annualUsed,
      s.annualRemaining,
      s.paidTotal,
      s.unpaidTotal,
      s.sickTotal,
      s.hourlyTotal,
      s.totalDays
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Y. İzin Hak', 'Y. İzin Kul.', 'Y. İzin Kalan', 'Ücretli', 'Ücretsiz', 'Raporlu', 'Saatlik', 'Toplam']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`Izin_Toplamlari_${selectedYear}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          aside, header, .no-print, .filters-section, .pagination-footer { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .bg-white { border: none !important; shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 4px !important; font-size: 8px !important; }
          body { background: white !important; overflow: visible !important; }
          .min-h-screen { min-height: auto !important; }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Toplamları</h1>
          <p className="text-sm text-slate-500">Personel bazlı yıllık ve diğer izin türlerinin özet raporu.</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <div className="relative">
            <button 
              onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-slate-800/20"
            >
              <Printer size={18} />
              <span>Yazdır / PDF</span>
              <ChevronDownIcon size={16} className={cn("transition-transform", isPrintMenuOpen && "rotate-180")} />
            </button>

            {isPrintMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsPrintMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={handlePrint}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <Printer size={16} />
                    <span>Yazdır (Tarayıcı)</span>
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <FileDown size={16} />
                    <span>PDF Olarak İndir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end no-print">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel Ara</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Ad veya Sicil No..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Şube</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="Tüm Şubeler">Tüm Şubeler</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Yıl</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {[2023, 2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">İzin Türü</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
            >
              {LEAVE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => setCurrentPage(1)}
          className="bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-2 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20"
        >
          Ara
        </button>
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Y. İzin Hak</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Y. İzin Kul.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Y. İzin Kalan</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Ücretli</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Ücretsiz</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Raporlu</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Saatlik (S)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Toplam (G)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSummaries.map((s) => (
                <tr key={s.employeeId} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{s.employeeCode}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{s.employeeName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {s.branchName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700 text-center">{s.annualAllowance}</td>
                  <td className="px-6 py-4 text-sm font-bold text-whatsapp-600 text-center">{s.annualUsed}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">{s.annualRemaining}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 text-center">{s.paidTotal}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 text-center">{s.unpaidTotal}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 text-center">{s.sickTotal}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 text-center">{s.hourlyTotal}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-whatsapp-50 text-whatsapp-600 text-xs font-black">
                      {s.totalDays}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedSummaries.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            {[25, 50, 100].map(size => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                  pageSize === size ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {size}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-2">kayıt gösteriliyor</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-slate-600 px-4">
              {currentPage} / {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
