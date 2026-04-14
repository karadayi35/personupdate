import React from 'react';
import { 
  Search, 
  Plus, 
  Printer, 
  Trash2, 
  Edit2, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Building2,
  Calendar,
  X,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  Coffee,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { BreakRecord } from '@/types/breaks';
import { format, parseISO, differenceInMinutes, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BREAK_TYPES = ['Çay Molası', 'Yemek Molası', 'İhtiyaç Molası', 'Diğer'];

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

export default function BreakTracking() {
  const [records, setRecords] = React.useState<BreakRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchCode, setSearchCode] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Table states
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState<BreakRecord | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  
  // Form states
  const [formData, setFormData] = React.useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    endTime: '',
    type: 'Çay Molası' as BreakRecord['type']
  });

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const q = query(collection(db, 'break_records'), orderBy('date', 'desc'), orderBy('startTime', 'desc'));
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
      unsubRecords();
    };
  }, []);

  const getEmployeeBranch = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return '-';
    const branch = branches.find(b => b.id === emp.branchId);
    return branch?.name || '-';
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCode = r.employeeCode.toLowerCase().includes(searchCode.toLowerCase());
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || r.branchName === selectedBranch;
    const matchesType = selectedType === 'Tümünde' || r.type === selectedType;
    const matchesDate = !selectedDate || r.date === selectedDate;
    
    return matchesSearch && matchesCode && matchesBranch && matchesType && matchesDate;
  });

  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const employee = employees.find(emp => emp.id === formData.employeeId);
      if (!employee) throw new Error('Personel seçilmedi.');

      const branch = branches.find(b => b.id === employee.branchId);
      
      let totalMinutes = 0;
      if (formData.endTime) {
        const start = new Date(`${formData.date}T${formData.startTime}`);
        const end = new Date(`${formData.date}T${formData.endTime}`);
        totalMinutes = differenceInMinutes(end, start);
      }

      const newRecord: Partial<BreakRecord> = {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        branchId: employee.branchId,
        branchName: branch?.name || '-',
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime || undefined,
        totalMinutes: totalMinutes > 0 ? totalMinutes : undefined,
        type: formData.type,
        status: formData.endTime ? 'completed' : 'active',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
      };

      await addDoc(collection(db, 'break_records'), newRecord);
      setIsAddModalOpen(false);
      setFormData({
        employeeId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: format(new Date(), 'HH:mm'),
        endTime: '',
        type: 'Çay Molası'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'break_records');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateType = async (record: BreakRecord, newType: BreakRecord['type']) => {
    try {
      await updateDoc(doc(db, 'break_records', record.id), {
        type: newType,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'break_records');
    }
  };

  const handleDelete = async (record: BreakRecord) => {
    if (!window.confirm(`${record.employeeName} isimli personelin mola kaydını silmek istediğinize emin misiniz?`)) return;
    
    try {
      await deleteDoc(doc(db, 'break_records', record.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'break_records');
    }
  };

  const handlePrint = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Mola Kayıt ve Takip Listesi', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredRecords.map((r, i) => [
      i + 1,
      r.employeeCode,
      r.employeeName,
      r.branchName,
      format(parseISO(r.date), 'dd.MM.yyyy'),
      r.type,
      r.startTime,
      r.endTime || '-',
      r.totalMinutes ? `${r.totalMinutes} dk` : '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Tarih', 'Mola Türü', 'Başlangıç', 'Bitiş', 'Süre']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      styles: { fontSize: 8 }
    });

    doc.save(`Mola_Kayitlari_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const isIrregular = (record: BreakRecord) => {
    if (record.status === 'active') return false;
    if (!record.endTime) return true;
    
    const start = new Date(`${record.date}T${record.startTime}`);
    const end = new Date(`${record.date}T${record.endTime}`);
    const diff = differenceInMinutes(end, start);
    
    if (diff <= 0) return true;
    if (diff > 120) return true; // 2 saatten uzun mola düzensiz sayılabilir
    
    return false;
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mola Türü</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="Tümünde">Tümünde</option>
            {BREAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tarih</label>
          <input 
            type="date"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-slate-800/20"
          >
            <Printer size={18} />
            <span>Yazdır</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
          >
            <Plus size={18} />
            <span>Yeni Kayıt</span>
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mola Türü</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Saatler</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Süre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{r.employeeCode}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{r.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{r.branchName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">
                    {format(parseISO(r.date), 'dd MMM yyyy', { locale: tr })}
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="bg-slate-100 border-none rounded-lg py-1 px-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                      value={r.type}
                      onChange={(e) => handleUpdateType(r, e.target.value as BreakRecord['type'])}
                    >
                      {BREAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 py-1 px-2 rounded-lg">
                      <Clock size={12} />
                      {r.startTime} - {r.endTime || '...'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.totalMinutes ? (
                      <span className={cn(
                        "text-sm font-black",
                        isIrregular(r) ? "text-whatsapp-600" : "text-emerald-600"
                      )}>
                        {r.totalMinutes} dk
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-500 animate-pulse">Devam Ediyor</span>
                    )}
                    {isIrregular(r) && (
                      <div className="flex items-center justify-center gap-1 mt-1 text-[10px] font-bold text-whatsapp-500 uppercase tracking-tight">
                        <AlertCircle size={10} />
                        Düzensiz
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDelete(r)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Mola kaydı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Toplam {filteredRecords.length} Kayıt
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Yeni Mola Kaydı</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddRecord} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Personel Seçimi</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  >
                    <option value="">Personel Seçiniz...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tarih</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Mola Türü</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as BreakRecord['type'] })}
                    >
                      {BREAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Başlangıç Saati</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bitiş Saati (Opsiyonel)</label>
                    <input 
                      type="time"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-2xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  <span>Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
