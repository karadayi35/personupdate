import React from 'react';
import { 
  Search, 
  Plus, 
  Printer, 
  Trash2, 
  Eye, 
  Edit2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X,
  Loader2,
  FileDown,
  ChevronDown as ChevronDownIcon,
  Calendar,
  Clock,
  User,
  Building2,
  Info,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  where,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { LeaveRecord } from '@/types/leaves';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
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

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm Durumlar', color: 'bg-slate-100 text-slate-600' },
  { value: 'pending', label: 'Beklemede', color: 'bg-amber-100 text-amber-600' },
  { value: 'approved', label: 'Onaylandı', color: 'bg-emerald-100 text-emerald-600' },
  { value: 'rejected', label: 'Reddedildi', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'cancelled', label: 'İptal Edildi', color: 'bg-slate-100 text-slate-400' }
];

const LEAVE_TYPES = [
  'Tümünde',
  'Saatlik İzin',
  'Özel İzin (Saatlik)',
  'Doktor Randevusu',
  'Veli İzni'
];

export default function HourlyLeaveList() {
  const navigate = useNavigate();
  const [leaves, setLeaves] = React.useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchCode, setSearchCode] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedStatus, setSelectedStatus] = React.useState('all');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  
  // Table states
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState<keyof LeaveRecord>('startDate');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  
  // Modal states
  const [selectedLeave, setSelectedLeave] = React.useState<LeaveRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const q = query(
      collection(db, 'leave_records'), 
      where('isHourly', '==', true),
      orderBy('startDate', 'desc')
    );
    
    const unsubLeaves = onSnapshot(q, (snap) => {
      setLeaves(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_records');
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubBranches();
      unsubLeaves();
    };
  }, []);

  const getEmployeeBranch = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return '-';
    const branch = branches.find(b => b.id === emp.branchId);
    return branch?.name || '-';
  };

  const filteredLeaves = leaves.filter(l => {
    const matchesSearch = l.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCode = l.employeeCode.toLowerCase().includes(searchCode.toLowerCase());
    const branchName = getEmployeeBranch(l.employeeId);
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || branchName === selectedBranch;
    const matchesType = selectedType === 'Tümünde' || l.leaveTypeName === selectedType;
    const matchesStatus = selectedStatus === 'all' || l.status === selectedStatus;
    
    let matchesDate = true;
    if (startDate && endDate) {
      const leaveDate = parseISO(l.startDate);
      matchesDate = isWithinInterval(leaveDate, { 
        start: parseISO(startDate), 
        end: parseISO(endDate) 
      });
    } else if (startDate) {
      matchesDate = l.startDate >= startDate;
    } else if (endDate) {
      matchesDate = l.startDate <= endDate;
    }

    return matchesSearch && matchesCode && matchesBranch && matchesType && matchesStatus && matchesDate;
  });

  const sortedLeaves = [...filteredLeaves].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedLeaves = sortedLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sortedLeaves.length / pageSize);

  const handleDelete = async (leave: LeaveRecord) => {
    if (!window.confirm(`${leave.employeeName} isimli personelin saatlik iznini silmek istediğinize emin misiniz?`)) return;
    
    try {
      await deleteDoc(doc(db, 'leave_records', leave.id));
      
      // Log deletion
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: leave.id,
        employeeId: leave.employeeId,
        employeeName: leave.employeeName,
        employeeCode: leave.employeeCode,
        branchName: getEmployeeBranch(leave.employeeId),
        leaveTypeName: leave.leaveTypeName,
        actionType: 'delete',
        oldData: leave,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leave_records');
    }
  };

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
    doc.text('Saatlik İzin Kayıtları Listesi', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = sortedLeaves.map((l, i) => [
      i + 1,
      l.employeeCode,
      l.employeeName,
      getEmployeeBranch(l.employeeId),
      format(parseISO(l.startDate), 'dd.MM.yyyy'),
      l.startTime || '-',
      l.endTime || '-',
      `${l.totalHours || 0} Saat`,
      l.leaveTypeName,
      l.status === 'approved' ? 'Onaylandı' : l.status === 'pending' ? 'Beklemede' : 'Reddedildi'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Tarih', 'Başlangıç', 'Bitiş', 'Süre', 'Tür', 'Durum']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      styles: { fontSize: 8 }
    });

    doc.save(`Saatlik_Izin_Listesi_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handlePrintSingle = (l: LeaveRecord) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Saatlik İzin Formu', 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const data = [
      ['Sicil No', l.employeeCode],
      ['Personel Adı', l.employeeName],
      ['Şube', getEmployeeBranch(l.employeeId)],
      ['İzin Tarihi', format(parseISO(l.startDate), 'dd.MM.yyyy')],
      ['Saat Aralığı', `${l.startTime} - ${l.endTime}`],
      ['Toplam Süre', `${l.totalHours} Saat`],
      ['İzin Türü', l.leaveTypeName],
      ['Kısa Açıklama', l.shortDescription || '-'],
      ['Not', l.note || '-'],
      ['Durum', STATUS_OPTIONS.find(s => s.value === l.status)?.label || l.status],
      ['Oluşturan', l.createdBy],
      ['Oluşturulma', l.createdAt ? format(l.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-']
    ];

    autoTable(doc, {
      startY: 40,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    doc.save(`Saatlik_Izin_${l.employeeCode}_${l.startDate}.pdf`);
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Saatlik İzinleri Listele</h1>
          <p className="text-sm text-slate-500">Personellere ait saatlik izin kayıtlarını yönetin ve denetleyin.</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <button 
            onClick={() => navigate('/leaves/hourly/add')}
            className="flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
          >
            <Plus size={18} />
            <span>Yeni Ekle</span>
          </button>
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end no-print filters-section">
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Durum</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Saatler</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Süre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tür</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right no-print">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeaves.map((l) => (
                <tr 
                  key={l.id} 
                  onClick={() => { setSelectedLeave(l); setIsViewModalOpen(true); }}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{l.employeeCode}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{l.employeeName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{getEmployeeBranch(l.employeeId)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{format(parseISO(l.startDate), 'dd MMM yyyy', { locale: tr })}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 py-1 px-2 rounded-lg">
                      <Clock size={12} />
                      {l.startTime} - {l.endTime}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-black text-whatsapp-600">{l.totalHours} Saat</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{l.leaveTypeName}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      STATUS_OPTIONS.find(s => s.value === l.status)?.color
                    )}>
                      {STATUS_OPTIONS.find(s => s.value === l.status)?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right no-print" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedLeave(l); setIsViewModalOpen(true); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                        title="Görüntüle"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => navigate(`/leaves/hourly/add?id=${l.id}`)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                        title="Düzenle"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(l)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => handlePrintSingle(l)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-all"
                        title="Yazdır"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedLeaves.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-slate-400 italic">
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
            Toplam {sortedLeaves.length} Kayıt
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
      {isViewModalOpen && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Saatlik İzin Detayı</h2>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              {/* Personnel Section */}
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center shrink-0">
                  <User size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-800">{selectedLeave.employeeName}</h3>
                  <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-lg">#{selectedLeave.employeeCode}</span>
                    <span className="flex items-center gap-1">
                      <Building2 size={14} />
                      {getEmployeeBranch(selectedLeave.employeeId)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Tarihi</p>
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <Calendar size={16} className="text-whatsapp-500" />
                    {format(parseISO(selectedLeave.startDate), 'dd MMMM yyyy', { locale: tr })}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saat Aralığı</p>
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <Clock size={16} className="text-whatsapp-500" />
                    {selectedLeave.startTime} - {selectedLeave.endTime}
                  </div>
                </div>
                <div className="p-4 bg-whatsapp-50 rounded-2xl border border-whatsapp-100 space-y-1">
                  <p className="text-[10px] font-bold text-whatsapp-400 uppercase tracking-wider">Toplam Süre</p>
                  <p className="text-xl font-black text-whatsapp-600">{selectedLeave.totalHours} Saat</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</p>
                  <p className="text-sm font-bold text-slate-700">{selectedLeave.leaveTypeName}</p>
                </div>
              </div>

              {/* Description & Notes */}
              <div className="space-y-4">
                {selectedLeave.documentUrl && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Belge Eki</p>
                    <a 
                      href={selectedLeave.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-fit bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                      <ExternalLink size={16} />
                      <span>Belgeyi Görüntüle</span>
                    </a>
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kısa Açıklama</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 italic">
                    {selectedLeave.shortDescription || '-'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Açıklama / Not</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedLeave.note || '-'}
                  </div>
                </div>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oluşturan</p>
                  <p className="text-xs font-bold text-slate-600">{selectedLeave.createdBy}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Durum</p>
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    STATUS_OPTIONS.find(s => s.value === selectedLeave.status)?.color
                  )}>
                    {STATUS_OPTIONS.find(s => s.value === selectedLeave.status)?.label}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oluşturulma</p>
                  <p className="text-xs font-medium text-slate-500">
                    {selectedLeave.createdAt ? format(selectedLeave.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Son Güncelleme</p>
                  <p className="text-xs font-medium text-slate-500">
                    {selectedLeave.updatedAt ? format(selectedLeave.updatedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handlePrintSingle(selectedLeave)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >
                  <Printer size={16} />
                  <span>Yazdır</span>
                </button>
                <button 
                  onClick={() => navigate(`/leaves/hourly/add?id=${selectedLeave.id}`)}
                  className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >
                  <Edit2 size={16} />
                  <span>Düzenle</span>
                </button>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
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
