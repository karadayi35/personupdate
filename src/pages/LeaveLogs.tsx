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
  Eye,
  History,
  User,
  Clock,
  ArrowRight,
  X,
  FileText,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { LeaveChangeLog } from '@/types/leaves';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Branch {
  id: string;
  name: string;
}

const ACTION_TYPES = [
  { value: 'all', label: 'Tüm İşlemler', color: 'bg-slate-100 text-slate-600' },
  { value: 'create', label: 'Ekleme', color: 'bg-emerald-100 text-emerald-600' },
  { value: 'update', label: 'Güncelleme', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'delete', label: 'Silme', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'approve', label: 'Onaylama', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'reject', label: 'Reddetme', color: 'bg-whatsapp-100 text-whatsapp-700' },
  { value: 'cancel', label: 'İptal', color: 'bg-slate-100 text-slate-400' },
];

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

export default function LeaveLogs() {
  const [logs, setLogs] = React.useState<LeaveChangeLog[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchCode, setSearchCode] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedAction, setSelectedAction] = React.useState('all');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedUser, setSelectedUser] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Pagination
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Modals
  const [selectedLog, setSelectedLog] = React.useState<LeaveChangeLog | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const unsubBranches = onSnapshot(branchesRef, (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const logsRef = collection(db, 'leave_change_logs');
    const q = query(logsRef, orderBy('changedAt', 'desc'));
    const unsubLogs = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveChangeLog)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_change_logs');
    });

    return () => {
      unsubBranches();
      unsubLogs();
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCode = log.employeeCode?.toLowerCase().includes(searchCode.toLowerCase());
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || log.branchName === selectedBranch;
    const matchesAction = selectedAction === 'all' || log.actionType === selectedAction;
    const matchesType = selectedType === 'Tümünde' || log.leaveTypeName === selectedType;
    const matchesUser = !selectedUser || log.changedBy.toLowerCase().includes(selectedUser.toLowerCase());
    
    let matchesDates = true;
    if (startDate && log.changedAt) {
      const logDate = log.changedAt.toDate().toISOString().split('T')[0];
      matchesDates = matchesDates && logDate >= startDate;
    }
    if (endDate && log.changedAt) {
      const logDate = log.changedAt.toDate().toISOString().split('T')[0];
      matchesDates = matchesDates && logDate <= endDate;
    }

    return matchesSearch && matchesCode && matchesBranch && matchesAction && matchesType && matchesUser && matchesDates;
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handlePrintList = () => {
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
    doc.text('İzin Değişiklik Kayıtları Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredLogs.map((log, index) => [
      index + 1,
      log.employeeCode || '-',
      log.employeeName || '-',
      log.branchName || '-',
      ACTION_TYPES.find(a => a.value === log.actionType)?.label || log.actionType,
      log.leaveTypeName || '-',
      log.changedBy,
      log.changedAt ? format(log.changedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'İşlem', 'İzin Türü', 'Kullanıcı', 'Tarih']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      styles: { fontSize: 8 }
    });

    doc.save(`Izin_Degisiklik_Kayitlari_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const handlePrintSingle = (log: LeaveChangeLog) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Değişiklik Kaydı Detayı', 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const data = [
      ['Kayıt No', `#${log.id.toUpperCase()}`],
      ['Personel', log.employeeName || '-'],
      ['Sicil No', log.employeeCode || '-'],
      ['Şube', log.branchName || '-'],
      ['İşlem Türü', ACTION_TYPES.find(a => a.value === log.actionType)?.label || log.actionType],
      ['İzin Türü', log.leaveTypeName || '-'],
      ['Değişikliği Yapan', log.changedBy],
      ['Değişiklik Tarihi', log.changedAt ? format(log.changedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'],
      ['Açıklama', log.note || '-']
    ];

    autoTable(doc, {
      startY: 40,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    doc.save(`Log_Detayi_${log.id.slice(-6)}.pdf`);
  };

  const renderDataDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <p className="text-slate-400 italic">Veri bulunamadı.</p>;
    
    const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]))
      .filter(key => !['createdAt', 'updatedAt', 'id', 'employeeId', 'employeeName', 'employeeCode', 'branchName', 'leaveTypeName'].includes(key));

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4">
          <div>Eski Değer</div>
          <div>Yeni Değer</div>
        </div>
        <div className="space-y-2">
          {allKeys.map(key => {
            const oldVal = oldData?.[key];
            const newVal = newData?.[key];
            const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            if (!isChanged && !oldVal && !newVal) return null;

            return (
              <div key={key} className={cn(
                "grid grid-cols-2 gap-4 p-3 rounded-xl border transition-all",
                isChanged ? "bg-amber-50/30 border-amber-100" : "bg-slate-50/30 border-slate-100"
              )}>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{key}</p>
                  <p className="text-sm text-slate-600 break-all">{oldVal?.toString() || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{key}</p>
                  <p className={cn("text-sm break-all font-bold", isChanged ? "text-whatsapp-600" : "text-slate-600")}>
                    {newVal?.toString() || '-'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Değişiklik Kayıtları</h1>
          <p className="text-sm text-slate-500">İzin kayıtları üzerinde yapılan tüm işlemlerin denetim günlüğü.</p>
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
                  <button onClick={handlePrintList} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <Printer size={16} /> <span>Yazdır (Tarayıcı)</span>
                  </button>
                  <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <FileDown size={16} /> <span>PDF Olarak İndir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end no-print">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel / Sicil</label>
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">İşlem Türü</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">İzin Türü</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kullanıcı</label>
          <input 
            type="text"
            placeholder="Değişikliği yapan..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Başlangıç</label>
          <input 
            type="date"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bitiş</label>
          <input 
            type="date"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kayıt No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">İşlem</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kullanıcı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right no-print">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log) => (
                <tr 
                  key={log.id} 
                  onClick={() => { setSelectedLog(log); setIsViewModalOpen(true); }}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">#{log.id.slice(-6).toUpperCase()}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{log.employeeName || '-'}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{log.employeeCode} • {log.branchName}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      ACTION_TYPES.find(a => a.value === log.actionType)?.color
                    )}>
                      {ACTION_TYPES.find(a => a.value === log.actionType)?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{log.leaveTypeName || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {log.changedBy.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{log.changedBy}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">
                      {log.changedAt ? format(log.changedAt.toDate(), 'dd MMM yyyy', { locale: tr }) : '-'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {log.changedAt ? format(log.changedAt.toDate(), 'HH:mm') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right no-print" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedLog(log); setIsViewModalOpen(true); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handlePrintSingle(log)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
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
          </div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-all">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-slate-600 px-4">{currentPage} / {totalPages || 1}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 transition-all">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Değişiklik Kaydı Detayı</h3>
                  <p className="text-xs text-slate-400 font-medium">#{selectedLog.id.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Personnel & Action Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</p>
                  <p className="text-sm font-bold text-slate-900">{selectedLog.employeeName || '-'}</p>
                  <p className="text-xs text-slate-500">{selectedLog.employeeCode} • {selectedLog.branchName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İşlem / İzin Türü</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      ACTION_TYPES.find(a => a.value === selectedLog.actionType)?.color
                    )}>
                      {ACTION_TYPES.find(a => a.value === selectedLog.actionType)?.label}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{selectedLog.leaveTypeName || '-'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Değişikliği Yapan</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <User size={14} className="text-whatsapp-500" />
                    {selectedLog.changedBy}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <Clock size={12} />
                    {selectedLog.changedAt ? format(selectedLog.changedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                  </div>
                </div>
              </div>

              {/* Data Comparison */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={16} className="text-whatsapp-500" />
                  Veri Karşılaştırması
                </h4>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  {renderDataDiff(selectedLog.oldData, selectedLog.newData)}
                </div>
              </div>

              {/* Note */}
              {selectedLog.note && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">İşlem Notu / Açıklama</p>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-sm text-amber-700 leading-relaxed italic">
                    "{selectedLog.note}"
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">
                Kapat
              </button>
              <button 
                onClick={() => handlePrintSingle(selectedLog)}
                className="px-8 py-2.5 text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 rounded-xl transition-all shadow-lg shadow-slate-800/20 flex items-center gap-2"
              >
                <Printer size={16} />
                Yazdır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
