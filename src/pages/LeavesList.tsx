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
  CheckCircle2,
  AlertCircle,
  FileDown,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { LeaveRecord, LeaveType, LeaveBalance, LeaveChangeLog } from '@/types/leaves';
import { format, differenceInDays, parseISO, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  branchId: string;
}

const LEAVE_TYPES = [
  'Yıllık İzin',
  'Ücretli İzin',
  'Ücretsiz İzin',
  'Raporlu',
  'Babalık İzni',
  'Doğum İzni',
  'Mazeret ve Diğer Ücretli İzinler',
  'Saatlik İzin'
];

import { useNavigate } from 'react-router-dom';

export default function LeavesList() {
  const navigate = useNavigate();
  const [leaves, setLeaves] = React.useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedLeaveType, setSelectedLeaveType] = React.useState('Tümünde');
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [selectedLeave, setSelectedLeave] = React.useState<LeaveRecord | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    employeeId: '',
    leaveTypeName: 'Yıllık İzin',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    shortDescription: '',
    note: '',
    status: 'approved' as const
  });

  const isAdmin = auth.currentUser?.email === 'aalikirmizigul89@gmail.com';

  React.useEffect(() => {
    const employeesRef = collection(db, 'employees');
    const unsubscribeEmployees = onSnapshot(employeesRef, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    const branchesRef = collection(db, 'branches');
    const unsubscribeBranches = onSnapshot(branchesRef, (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const leavesRef = collection(db, 'leave_records');
    const q = query(leavesRef, orderBy('createdAt', 'desc'));
    const unsubscribeLeaves = onSnapshot(q, (snapshot) => {
      setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_records');
    });

    return () => {
      unsubscribeEmployees();
      unsubscribeBranches();
      unsubscribeLeaves();
    };
  }, []);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const start = parseISO(formData.startDate);
    const end = parseISO(formData.endDate);

    if (start > end) {
      alert('Başlangıç tarihi bitiş tarihinden büyük olamaz.');
      setSubmitting(false);
      return;
    }

    // Conflict check
    const conflicts = leaves.filter(l => 
      l.employeeId === formData.employeeId && 
      l.status !== 'rejected' &&
      l.status !== 'cancelled' &&
      (
        isWithinInterval(start, { start: parseISO(l.startDate), end: parseISO(l.endDate) }) ||
        isWithinInterval(end, { start: parseISO(l.startDate), end: parseISO(l.endDate) }) ||
        isWithinInterval(parseISO(l.startDate), { start, end })
      )
    );

    if (conflicts.length > 0) {
      alert('Seçilen tarih aralığında personelin zaten bir izni bulunmaktadır.');
      setSubmitting(false);
      return;
    }

    const employee = employees.find(e => e.id === formData.employeeId);
    const totalDays = differenceInDays(end, start) + 1;

    try {
      const newLeave = {
        ...formData,
        employeeName: employee?.name || '',
        employeeCode: employee?.employeeCode || '',
        totalDays,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'leave_records'), newLeave);

      // Log change
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: docRef.id,
        employeeId: formData.employeeId,
        employeeName: employee?.name || '',
        employeeCode: employee?.employeeCode || '',
        branchName: employee?.branchId ? branches.find(b => b.id === employee.branchId)?.name : '',
        leaveTypeName: formData.leaveTypeName,
        actionType: 'create',
        newData: newLeave,
        oldData: null,
        note: formData.note,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp()
      });

      setIsAddModalOpen(false);
      setFormData({
        employeeId: '',
        leaveTypeName: 'Yıllık İzin',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        shortDescription: '',
        note: '',
        status: 'approved'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_records');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;
    setSubmitting(true);

    const start = parseISO(formData.startDate);
    const end = parseISO(formData.endDate);
    const totalDays = differenceInDays(end, start) + 1;

    try {
      const updatedData = {
        ...formData,
        totalDays,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'leave_records', selectedLeave.id), updatedData);

      // Log change
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: selectedLeave.id,
        employeeId: selectedLeave.employeeId,
        employeeName: selectedLeave.employeeName,
        employeeCode: selectedLeave.employeeCode,
        branchName: '', // Could fetch if needed
        leaveTypeName: selectedLeave.leaveTypeName,
        actionType: 'update',
        oldData: selectedLeave,
        newData: updatedData,
        note: formData.note,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp()
      });

      setIsEditModalOpen(false);
      setSelectedLeave(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leave_records');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeave = async (leave: LeaveRecord) => {
    if (!window.confirm(`${leave.employeeName} isimli personelin iznini silmek istediğinize emin misiniz?`)) return;

    try {
      await deleteDoc(doc(db, 'leave_records', leave.id));
      
      // Log change
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: leave.id,
        employeeId: leave.employeeId,
        employeeName: leave.employeeName,
        employeeCode: leave.employeeCode,
        branchName: '',
        leaveTypeName: leave.leaveTypeName,
        actionType: 'delete',
        oldData: leave,
        newData: null,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leave_records');
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    const matchesSearch = 
      leave.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedLeaveType === 'Tümünde' || leave.leaveTypeName === selectedLeaveType;

    return matchesSearch && matchesType;
  });

  const paginatedLeaves = filteredLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredLeaves.length / pageSize);

  const handlePrint = () => {
    setIsPrintMenuOpen(false);
    // Small timeout to allow the menu to close and UI to stabilize
    setTimeout(() => {
      window.focus();
      window.print();
    }, 150);
  };

  const handleDownloadPDF = () => {
    setIsPrintMenuOpen(false);
    const doc = new jsPDF();
    
    // Add Title
    doc.setFontSize(18);
    doc.text('Patron İzin Raporu', 14, 22);
    
    // Add Subtitle
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);
    doc.text(`Filtre: ${selectedLeaveType}`, 14, 36);

    // Prepare Table Data
    const tableData = filteredLeaves.map((leave, index) => [
      index + 1,
      leave.employeeCode,
      leave.employeeName,
      leave.leaveTypeName,
      format(parseISO(leave.startDate), 'dd.MM.yyyy'),
      format(parseISO(leave.endDate), 'dd.MM.yyyy'),
      leave.totalDays
    ]);

    // Generate Table
    autoTable(doc, {
      startY: 45,
      head: [['#', 'Sicil No', 'Personel', 'İzin Türü', 'Başlangıç', 'Bitiş', 'Gün']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`Izin_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          aside, header, .no-print, .filters-section, .pagination-footer { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .bg-white { border: none !important; shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 8px !important; font-size: 10px !important; }
          .print-only { display: block !important; }
          body { background: white !important; overflow: visible !important; }
          .min-h-screen { min-height: auto !important; }
        }
        .print-only { display: none; }
      `}} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzinleri Listele</h1>
          <p className="text-sm text-slate-500">Bu sayfada, kullanıcılarınıza izin tanımlayabilir / ekleyebilirsiniz.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/leaves/add')}
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
              <span>Yazdır</span>
              <ChevronDownIcon size={16} className={cn("transition-transform", isPrintMenuOpen && "rotate-180")} />
            </button>

            {isPrintMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsPrintMenuOpen(false)}
                />
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Ara..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
            value={selectedLeaveType}
            onChange={(e) => setSelectedLeaveType(e.target.value)}
          >
            <option value="Tümünde">Tümünde</option>
            {LEAVE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <button className="w-full md:w-auto bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold px-8 py-2.5 rounded-xl transition-all">
          Ara
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Sicil No</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Kullanıcı</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">İzin Türü</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span>↓ Başlangıç (Dahil)</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Bitiş (Dahil)</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Kısa Açıklama</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Oluşturan Yönetici</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider">Oluşturuldu</th>
                <th className="px-4 py-4 text-xs font-bold text-slate-800 uppercase tracking-wider text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Loader2 className="animate-spin text-whatsapp-600" size={24} />
                      <span className="font-medium">Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLeaves.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedLeaves.map((leave, index) => (
                  <tr key={leave.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 text-sm text-slate-500">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">{leave.employeeCode}</td>
                    <td className="px-4 py-4 text-sm text-slate-800 font-bold">{leave.employeeName}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{leave.leaveTypeName}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{format(parseISO(leave.startDate), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{format(parseISO(leave.endDate), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-4 text-sm text-slate-500 italic">{leave.shortDescription || '-'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{leave.createdBy}</td>
                    <td className="px-4 py-4 text-sm text-slate-400">
                      {leave.createdAt?.toDate ? format(leave.createdAt.toDate(), 'dd.MM.yyyy HH:mm:ss') : '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedLeave(leave);
                            setIsViewModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteLeave(leave)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-whatsapp-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedLeave(leave);
                            setIsViewModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-whatsapp-600 transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedLeave(leave);
                            setFormData({
                              employeeId: leave.employeeId,
                              leaveTypeName: leave.leaveTypeName,
                              startDate: leave.startDate,
                              endDate: leave.endDate,
                              shortDescription: leave.shortDescription,
                              note: leave.note,
                              status: leave.status
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            {[25, 50, 75, 100].map(size => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  pageSize === size ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                )}
              >
                {size}
              </button>
            ))}
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

      {/* Add/Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">{isEditModalOpen ? 'İzin Düzenle' : 'Yeni İzin Ekle'}</h2>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  setSelectedLeave(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={isEditModalOpen ? handleUpdateLeave : handleAddLeave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Personel / Kullanıcı Seçimi</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    disabled={isEditModalOpen}
                  >
                    <option value="">Personel Seçin</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">İzin Türü</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.leaveTypeName}
                    onChange={(e) => setFormData({ ...formData, leaveTypeName: e.target.value })}
                  >
                    {LEAVE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Başlangıç Tarihi</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Bitiş Tarihi</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Kısa Açıklama</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: Tatil, Sağlık vb."
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Açıklama / Not</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all min-h-[100px]"
                    placeholder="Detaylı açıklama..."
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Durum</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="approved">Onaylandı</option>
                    <option value="pending">Beklemede</option>
                    <option value="rejected">Reddedildi</option>
                    <option value="cancelled">İptal Edildi</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setSelectedLeave(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  <span>{isEditModalOpen ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">İzin Detayı</h2>
              <button 
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedLeave(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-whatsapp-50 flex items-center justify-center text-whatsapp-600 font-bold text-2xl border border-whatsapp-100">
                  {selectedLeave.employeeName[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedLeave.employeeName}</h3>
                  <p className="text-sm text-slate-500 font-mono">{selectedLeave.employeeCode}</p>
                </div>
                <div className="ml-auto">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    selectedLeave.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                    selectedLeave.status === 'pending' ? "bg-amber-50 text-amber-600" :
                    "bg-whatsapp-50 text-whatsapp-600"
                  )}>
                    {selectedLeave.status === 'approved' ? 'Onaylandı' :
                     selectedLeave.status === 'pending' ? 'Beklemede' :
                     selectedLeave.status === 'rejected' ? 'Reddedildi' : 'İptal'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</p>
                  <p className="text-sm font-bold text-slate-700">{selectedLeave.leaveTypeName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gün Sayısı</p>
                  <p className="text-sm font-bold text-slate-700">{selectedLeave.totalDays} Gün</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Başlangıç Tarihi</p>
                  <p className="text-sm font-bold text-slate-700">{format(parseISO(selectedLeave.startDate), 'dd MMMM yyyy', { locale: tr })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitiş Tarihi</p>
                  <p className="text-sm font-bold text-slate-700">{format(parseISO(selectedLeave.endDate), 'dd MMMM yyyy', { locale: tr })}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kısa Açıklama</p>
                <p className="text-sm text-slate-700 font-medium">{selectedLeave.shortDescription || '-'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Açıklama / Not</p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 italic">
                  {selectedLeave.note || 'Not eklenmemiş.'}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Oluşturan</span>
                  <span className="text-slate-600">{selectedLeave.createdBy}</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span>Oluşturulma</span>
                  <span className="text-slate-600">
                    {selectedLeave.createdAt?.toDate ? format(selectedLeave.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => {
                    setIsViewModalOpen(false);
                    setSelectedLeave(null);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-slate-800/20"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
