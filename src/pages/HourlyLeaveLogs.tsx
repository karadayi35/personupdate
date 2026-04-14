import React from 'react';
import { 
  Search, 
  Printer, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  X,
  Loader2,
  FileDown,
  ChevronDown as ChevronDownIcon,
  Calendar,
  Clock,
  User,
  History,
  ArrowRight,
  Info,
  ExternalLink,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  doc,
  Timestamp
} from 'firebase/firestore';
import { LeaveChangeLog } from '@/types/leaves';
import { format } from 'date-fns';
import { tr as localeTr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ACTION_TYPES = [
  { value: 'all', label: 'Tüm İşlemler', color: 'bg-slate-100 text-slate-600' },
  { value: 'create', label: 'Ekleme', color: 'bg-emerald-100 text-emerald-600' },
  { value: 'update', label: 'Güncelleme', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'delete', label: 'Silme', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'approve', label: 'Onaylama', color: 'bg-emerald-100 text-emerald-600' },
  { value: 'reject', label: 'Reddetme', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'cancel', label: 'İptal', color: 'bg-slate-100 text-slate-400' }
];

const LEAVE_TYPES = [
  'Tümünde',
  'Saatlik İzin',
  'Özel İzin (Saatlik)',
  'Doktor Randevusu',
  'Veli İzni'
];

export default function HourlyLeaveLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = React.useState<LeaveChangeLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchCode, setSearchCode] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedAction, setSelectedAction] = React.useState('all');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedUser, setSelectedUser] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  
  // Table states
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<LeaveChangeLog | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);

  const [userRole, setUserRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubUser = onSnapshot(doc(db, 'employees', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserRole(snap.data().role);
      }
    });

    return () => unsubUser();
  }, []);

  const isAdmin = userRole === 'admin' || auth.currentUser?.email === 'aalikirmizigul89@gmail.com';

  React.useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'leave_change_logs'),
      orderBy('changedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveChangeLog));
      // Filter logs to only show hourly leave related ones
      const hourlyLogs = allLogs.filter(log => {
        const isHourlyType = LEAVE_TYPES.includes(log.leaveTypeName || '');
        const dataIsHourly = log.newData?.isHourly || log.oldData?.isHourly;
        return isHourlyType || dataIsHourly;
      });
      setLogs(hourlyLogs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_change_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCode = log.employeeCode?.toLowerCase().includes(searchCode.toLowerCase());
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || log.branchName === selectedBranch;
    const matchesAction = selectedAction === 'all' || log.actionType === selectedAction;
    const matchesType = selectedType === 'Tümünde' || log.leaveTypeName === selectedType;
    const matchesUser = log.changedBy.toLowerCase().includes(selectedUser.toLowerCase());
    
    let matchesDate = true;
    if (startDate && endDate) {
      const logDate = log.changedAt.toDate();
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = logDate >= start && logDate <= end;
    }

    return matchesSearch && matchesCode && matchesBranch && matchesAction && matchesType && matchesUser && matchesDate;
  });

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handlePrintList = () => {
    setIsPrintMenuOpen(false);
    setTimeout(() => window.print(), 150);
  };

  const handleDownloadPDF = () => {
    setIsPrintMenuOpen(false);
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Saatlik İzin Değişiklik Kayıtları', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredLogs.map((log, i) => [
      i + 1,
      log.employeeCode || '-',
      log.employeeName || '-',
      log.branchName || '-',
      ACTION_TYPES.find(a => a.value === log.actionType)?.label || log.actionType,
      log.leaveTypeName || '-',
      log.changedBy,
      format(log.changedAt.toDate(), 'dd.MM.yyyy HH:mm')
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'İşlem', 'İzin Türü', 'Kullanıcı', 'Tarih']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 }
    });

    doc.save(`Saatlik_Izin_Loglari_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handlePrintSingle = (log: LeaveChangeLog) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Değişiklik Kaydı Detayı', 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Kayıt No: #${log.id.toUpperCase()}`, 14, 30);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 38);

    const data = [
      ['Sicil No', log.employeeCode || '-'],
      ['Personel Adı', log.employeeName || '-'],
      ['Şube', log.branchName || '-'],
      ['İşlem Türü', ACTION_TYPES.find(a => a.value === log.actionType)?.label || log.actionType],
      ['İzin Türü', log.leaveTypeName || '-'],
      ['Değişikliği Yapan', log.changedBy],
      ['Değişiklik Tarihi', log.changedAt ? format(log.changedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'],
      ['Açıklama / Not', log.note || '-']
    ];

    autoTable(doc, {
      startY: 45,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    // Add data comparison if possible
    if (log.oldData || log.newData) {
      doc.text('Veri Karşılaştırması', 14, (doc as any).lastAutoTable.finalY + 15);
      
      const diffData: any[] = [];
      const allKeys = Array.from(new Set([...Object.keys(log.oldData || {}), ...Object.keys(log.newData || {})]))
        .filter(key => !['createdAt', 'updatedAt', 'id', 'employeeId', 'employeeName', 'employeeCode', 'branchName', 'isHourly'].includes(key));

      allKeys.forEach(key => {
        diffData.push([key, log.oldData?.[key]?.toString() || '-', log.newData?.[key]?.toString() || '-']);
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Alan', 'Eski Değer', 'Yeni Değer']],
        body: diffData,
        theme: 'grid',
        styles: { fontSize: 8 }
      });
    }

    doc.save(`Degisiklik_Kaydi_${log.id.slice(-6).toUpperCase()}.pdf`);
  };

  const renderDataDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <p className="text-slate-400 italic">Veri bulunamadı.</p>;
    
    const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]))
      .filter(key => !['createdAt', 'updatedAt', 'id', 'employeeId', 'employeeName', 'employeeCode', 'branchName', 'isHourly'].includes(key));

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

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle size={48} className="text-whatsapp-500" />
        <h2 className="text-xl font-bold text-slate-800">Yetkisiz Erişim</h2>
        <p className="text-slate-500">Bu sayfayı görüntülemek için yönetici yetkisine sahip olmalısınız.</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Saatlik İzin Değişiklik Kayıtları</h1>
          <p className="text-sm text-slate-500">Saatlik izin kayıtları üzerinde yapılan tüm işlemlerin denetim günlüğü.</p>
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-end no-print filters-section">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Ad Soyad..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Sicil No</label>
          <input 
            type="text"
            placeholder="Sicil No..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
          />
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Tarih / Saat</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Süre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kullanıcı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İşlem Tarihi</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right no-print">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log) => {
                const data = log.newData || log.oldData || {};
                return (
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
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs font-bold text-slate-700">
                        {data.startDate ? format(new Date(data.startDate), 'dd.MM.yyyy') : '-'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {data.startTime} - {data.endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-black text-whatsapp-600">{data.totalHours || 0} Saat</span>
                    </td>
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
                        {log.changedAt ? format(log.changedAt.toDate(), 'dd MMM yyyy', { locale: localeTr }) : '-'}
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
                          title="Görüntüle"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handlePrintSingle(log)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-all"
                          title="Yazdır"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between pagination-footer">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Toplam {filteredLogs.length} Kayıt
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

      {/* View Modal */}
      {isViewModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Değişiklik Detayı</h2>
                  <p className="text-xs text-slate-500 font-medium">#{selectedLog.id.toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              {/* Personnel & Action Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center shrink-0">
                      <User size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 leading-tight">{selectedLog.employeeName || '-'}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedLog.employeeCode} • {selectedLog.branchName}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İşlem Türü</p>
                      <span className={cn(
                        "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        ACTION_TYPES.find(a => a.value === selectedLog.actionType)?.color
                      )}>
                        {ACTION_TYPES.find(a => a.value === selectedLog.actionType)?.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</p>
                      <p className="text-sm font-bold text-slate-700">{selectedLog.leaveTypeName || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Değişikliği Yapan</p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {selectedLog.changedBy.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{selectedLog.changedBy}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Değişiklik Tarihi</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Calendar size={14} className="text-whatsapp-500" />
                        {selectedLog.changedAt ? format(selectedLog.changedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-1">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">İşlem Notu / Açıklama</p>
                    <p className="text-sm text-amber-800 font-medium italic">
                      {selectedLog.note || 'Açıklama girilmemiş.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Comparison */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800">
                  <RefreshCw size={18} className="text-whatsapp-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Veri Karşılaştırması</h3>
                </div>
                {renderDataDiff(selectedLog.oldData, selectedLog.newData)}
              </div>

              {/* Link to Record */}
              {selectedLog.leaveRecordId && selectedLog.actionType !== 'delete' && (
                <div className="pt-4">
                  <button 
                    onClick={() => {
                      setIsViewModalOpen(false);
                      navigate(`/leaves/hourly/list`);
                    }}
                    className="flex items-center gap-2 text-whatsapp-600 hover:text-whatsapp-700 text-sm font-bold transition-colors group"
                  >
                    <ExternalLink size={16} />
                    <span>İlgili Saatlik İzin Kaydına Git</span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
