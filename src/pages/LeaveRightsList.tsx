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
  Edit2,
  Trash2,
  Plus,
  X,
  Info,
  ChevronDown as ChevronDownIcon,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { LeaveBalance } from '@/types/leaves';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Branch {
  id: string;
  name: string;
}

const LEAVE_TYPES = [
  'Tümünde',
  'Yıllık İzin',
  'Ücretli İzin',
  'Ücretsiz İzin',
  'Mazeret İzni'
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'passive', label: 'Pasif' },
];

export default function LeaveRightsList() {
  const navigate = useNavigate();
  const [balances, setBalances] = React.useState<LeaveBalance[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchCode, setSearchCode] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedYear, setSelectedYear] = React.useState('Tüm Yıllar');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedStatus, setSelectedStatus] = React.useState('all');

  // Pagination
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Modals
  const [selectedBalance, setSelectedBalance] = React.useState<LeaveBalance | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const unsubBranches = onSnapshot(branchesRef, (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const balancesRef = collection(db, 'leave_balances');
    const q = query(balancesRef, orderBy('year', 'desc'), orderBy('employeeName', 'asc'));
    const unsubBalances = onSnapshot(q, (snap) => {
      setBalances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveBalance)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_balances');
    });

    return () => {
      unsubBranches();
      unsubBalances();
    };
  }, []);

  const filteredBalances = balances.filter(b => {
    const matchesSearch = b.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCode = b.employeeCode.toLowerCase().includes(searchCode.toLowerCase());
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || b.branchName === selectedBranch;
    const matchesYear = selectedYear === 'Tüm Yıllar' || b.year.toString() === selectedYear;
    const matchesType = selectedType === 'Tümünde' || b.leaveTypeName === selectedType;
    const matchesStatus = selectedStatus === 'all' || b.status === selectedStatus;

    return matchesSearch && matchesCode && matchesBranch && matchesYear && matchesType && matchesStatus;
  });

  const paginatedBalances = filteredBalances.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredBalances.length / pageSize);

  const handleDelete = async (balance: LeaveBalance) => {
    if (!window.confirm(`${balance.employeeName} için tanımlanan ${balance.year} yılı ${balance.leaveTypeName} hakkını silmek istediğinize emin misiniz?`)) return;
    
    try {
      await deleteDoc(doc(db, 'leave_balances', balance.id));
      
      // Log deletion
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveBalanceId: balance.id,
        employeeId: balance.employeeId,
        employeeName: balance.employeeName,
        employeeCode: balance.employeeCode,
        branchName: balance.branchName,
        leaveTypeName: balance.leaveTypeName,
        actionType: 'delete',
        oldData: balance,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leave_balances');
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
    doc.text('İzin Hakları Listesi', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredBalances.map((b, index) => [
      index + 1,
      b.employeeCode,
      b.employeeName,
      b.branchName || '-',
      b.year,
      b.leaveTypeName,
      b.totalAllowance,
      b.usedDays,
      b.remainingDays,
      b.status === 'active' ? 'Aktif' : 'Pasif'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Yıl', 'İzin Türü', 'Toplam', 'Kullanılan', 'Kalan', 'Durum']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      styles: { fontSize: 9 }
    });

    doc.save(`Izin_Haklari_Listesi_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const handlePrintSingle = (b: LeaveBalance) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('İzin Hakkı Detay Belgesi', 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const data = [
      ['Sicil No', b.employeeCode],
      ['Personel Adı', b.employeeName],
      ['Şube', b.branchName || '-'],
      ['Yıl', b.year.toString()],
      ['İzin Türü', b.leaveTypeName],
      ['Toplam İzin Hakkı', `${b.totalAllowance} Gün`],
      ['Kullanılan İzin', `${b.usedDays} Gün`],
      ['Kalan İzin', `${b.remainingDays} Gün`],
      ['Durum', b.status === 'active' ? 'Aktif' : 'Pasif'],
      ['Not', b.note || '-'],
      ['Oluşturan', b.createdBy],
      ['Oluşturulma', b.createdAt ? format(b.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'],
      ['Son Güncelleme', b.updatedAt ? format(b.updatedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-']
    ];

    autoTable(doc, {
      startY: 40,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    doc.save(`Izin_Hakki_${b.employeeCode}_${b.year}.pdf`);
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Haklarını Listele</h1>
          <p className="text-sm text-slate-500">Personellere tanımlanan yıllık ve diğer izin haklarını yönetin.</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <button 
            onClick={() => navigate('/leaves/rights/add')}
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end no-print">
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Yıl</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="Tüm Yıllar">Tüm Yıllar</option>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>{y}</option>)}
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yıl</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Toplam</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Kullanılan</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Kalan</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right no-print">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBalances.map((b) => (
                <tr 
                  key={b.id} 
                  onClick={() => { setSelectedBalance(b); setIsViewModalOpen(true); }}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{b.employeeCode}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{b.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{b.branchName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700 text-center">{b.year}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{b.leaveTypeName}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700 text-center">{b.totalAllowance}</td>
                  <td className="px-6 py-4 text-sm font-bold text-whatsapp-600 text-center">
                    {b.leaveTypeName === 'Saatlik İzin' ? `${b.usedHours || 0} Saat` : b.usedDays}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-center">
                    {b.leaveTypeName === 'Saatlik İzin' ? '-' : b.remainingDays}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      b.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {b.status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right no-print" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedBalance(b); setIsViewModalOpen(true); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                        title="Görüntüle"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => navigate(`/leaves/rights/add?id=${b.id}`)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                        title="Düzenle"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handlePrintSingle(b)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                        title="Yazdır"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(b)}
                        className="p-2 hover:bg-whatsapp-50 rounded-lg text-whatsapp-400 hover:text-whatsapp-600 transition-all"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedBalances.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
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
      {isViewModalOpen && selectedBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">İzin Hakkı Detayı</h3>
                  <p className="text-xs text-slate-400 font-medium">{selectedBalance.year} Yılı • {selectedBalance.leaveTypeName}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Personnel Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</p>
                  <p className="text-sm font-bold text-slate-900">{selectedBalance.employeeName}</p>
                  <p className="text-xs text-slate-500">{selectedBalance.employeeCode} • {selectedBalance.branchName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Durum</p>
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    selectedBalance.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}>
                    {selectedBalance.status === 'active' ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-1 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Toplam Hak</p>
                  <p className="text-2xl font-black text-slate-800">{selectedBalance.totalAllowance} G</p>
                </div>
                <div className="p-6 bg-whatsapp-50 rounded-3xl border border-whatsapp-100 space-y-1 text-center">
                  <p className="text-[10px] font-bold text-whatsapp-600 uppercase tracking-wider">Kullanılan</p>
                  <p className="text-2xl font-black text-whatsapp-600">{selectedBalance.usedDays} G</p>
                </div>
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-1 text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Kalan</p>
                  <p className="text-2xl font-black text-emerald-700">{selectedBalance.remainingDays} G</p>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Açıklama / Not</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed italic">
                  "{selectedBalance.note || 'Açıklama girilmemiş.'}"
                </div>
              </div>

              {/* Audit Info */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oluşturan Yönetici</p>
                  <p className="text-xs font-bold text-slate-700">{selectedBalance.createdBy}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih Bilgileri</p>
                  <p className="text-[10px] text-slate-500">Oluşturulma: {selectedBalance.createdAt ? format(selectedBalance.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}</p>
                  <p className="text-[10px] text-slate-500">Güncelleme: {selectedBalance.updatedAt ? format(selectedBalance.updatedAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">
                Kapat
              </button>
              <button 
                onClick={() => handlePrintSingle(selectedBalance)}
                className="px-6 py-2.5 text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 rounded-xl transition-all shadow-lg shadow-slate-800/20 flex items-center gap-2"
              >
                <Printer size={16} />
                Yazdır
              </button>
              <button 
                onClick={() => navigate(`/leaves/rights/add?id=${selectedBalance.id}`)}
                className="px-8 py-2.5 text-sm font-bold bg-whatsapp-600 text-white hover:bg-whatsapp-700 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20"
              >
                Düzenle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
