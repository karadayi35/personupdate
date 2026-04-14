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
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Clock,
  FileText,
  MessageSquare,
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
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { LeaveRequest, LeaveRecord, LeaveBalance } from '@/types/leaves';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Branch {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm Durumlar', color: 'bg-slate-100 text-slate-600' },
  { value: 'pending', label: 'Beklemede', color: 'bg-amber-100 text-amber-600' },
  { value: 'approved', label: 'Onaylandı', color: 'bg-emerald-100 text-emerald-600' },
  { value: 'rejected', label: 'Reddedildi', color: 'bg-whatsapp-100 text-whatsapp-600' },
  { value: 'cancelled', label: 'İptal Edildi', color: 'bg-slate-100 text-slate-400' },
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

export default function LeaveRequests() {
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('Tüm Şubeler');
  const [selectedType, setSelectedType] = React.useState('Tümünde');
  const [selectedStatus, setSelectedStatus] = React.useState('all');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Pagination
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Modals
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequest | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = React.useState(false);
  const [managerComment, setManagerComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = React.useState(false);

  // Balance & Conflicts for selected request
  const [balance, setBalance] = React.useState<LeaveBalance | null>(null);
  const [conflicts, setConflicts] = React.useState<LeaveRecord[]>([]);

  React.useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const unsubBranches = onSnapshot(branchesRef, (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    const requestsRef = collection(db, 'leave_requests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leave_requests');
    });

    return () => {
      unsubBranches();
      unsubRequests();
    };
  }, []);

  // Fetch balance and conflicts when a request is selected for viewing
  React.useEffect(() => {
    if (!selectedRequest) return;

    const fetchData = async () => {
      // Balance
      const balanceRef = collection(db, 'leave_balances');
      const bQuery = query(
        balanceRef, 
        where('employeeId', '==', selectedRequest.employeeId),
        where('year', '==', new Date().getFullYear())
      );
      const bSnap = await getDocs(bQuery);
      if (!bSnap.empty) {
        setBalance({ id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as LeaveBalance);
      } else {
        setBalance(null);
      }

      // Conflicts
      const recordsRef = collection(db, 'leave_records');
      const cQuery = query(
        recordsRef,
        where('employeeId', '==', selectedRequest.employeeId),
        where('status', 'in', ['approved', 'pending'])
      );
      const cSnap = await getDocs(cQuery);
      const allRecords = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord));
      
      const start = parseISO(selectedRequest.startDate);
      const end = parseISO(selectedRequest.endDate);

      const overlapping = allRecords.filter(r => {
        const rStart = parseISO(r.startDate);
        const rEnd = parseISO(r.endDate);
        return (
          isWithinInterval(start, { start: rStart, end: rEnd }) ||
          isWithinInterval(end, { start: rStart, end: rEnd }) ||
          isWithinInterval(rStart, { start, end })
        );
      });
      setConflicts(overlapping);
    };

    fetchData();
  }, [selectedRequest]);

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBranch = selectedBranch === 'Tüm Şubeler' || r.branchName === selectedBranch;
    const matchesType = selectedType === 'Tümünde' || r.leaveTypeName === selectedType;
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    
    let matchesDates = true;
    if (startDate) matchesDates = matchesDates && r.startDate >= startDate;
    if (endDate) matchesDates = matchesDates && r.startDate <= endDate;

    return matchesSearch && matchesBranch && matchesType && matchesStatus && matchesDates;
  });

  const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredRequests.length / pageSize);

  const handleApprove = async (request: LeaveRequest) => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      console.log('Approving request:', request.id);
      // 1. Create Leave Record
      const leaveData: any = {
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        employeeCode: request.employeeCode,
        leaveTypeName: request.leaveTypeName,
        leaveTypeId: '', 
        startDate: request.startDate,
        endDate: request.endDate,
        startTime: request.startTime || null,
        endTime: request.endTime || null,
        totalDays: request.totalDays || 0,
        totalHours: request.totalHours || 0,
        isHourly: request.leaveTypeName === 'Saatlik İzin',
        shortDescription: (request.note || '').slice(0, 50),
        note: request.note || '',
        status: 'approved',
        reflectToPayroll: true,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      
      console.log('Creating leave record...');
      await addDoc(collection(db, 'leave_records'), leaveData);

      // 2. Update Balance if applicable
      if (balance) {
        console.log('Updating balance...');
        const balanceRef = doc(db, 'leave_balances', balance.id);
        if (request.leaveTypeName === 'Yıllık İzin') {
          await updateDoc(balanceRef, {
            usedDays: (balance.usedDays || 0) + request.totalDays,
            remainingDays: (balance.remainingDays || 0) - request.totalDays,
          });
        } else if (request.leaveTypeName === 'Saatlik İzin') {
          await updateDoc(balanceRef, {
            usedHours: (balance.usedHours || 0) + (request.totalHours || 0),
          });
        }
      }

      // 3. Update Request Status
      console.log('Updating request status...');
      const requestRef = doc(db, 'leave_requests', request.id);
      await updateDoc(requestRef, {
        status: 'approved',
        reviewedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        reviewedAt: serverTimestamp(),
      });

      // 4. Log Action
      console.log('Logging action...');
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRequestId: request.id,
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        employeeCode: request.employeeCode,
        branchName: request.branchName || '',
        leaveTypeName: request.leaveTypeName,
        actionType: 'approve',
        newData: { status: 'approved' },
        oldData: { status: 'pending' },
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });

      console.log('Approval successful!');
      setIsViewModalOpen(false);
      setSelectedRequest(null);
    } catch (error: any) {
      console.error('Approval Error:', error);
      setErrorMessage('Onaylama sırasında bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const requestRef = doc(db, 'leave_requests', selectedRequest.id);
      await updateDoc(requestRef, {
        status: 'rejected',
        managerComment,
        reviewedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        reviewedAt: serverTimestamp(),
      });

      // Log Action
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRequestId: selectedRequest.id,
        employeeId: selectedRequest.employeeId,
        employeeName: selectedRequest.employeeName,
        employeeCode: selectedRequest.employeeCode,
        branchName: selectedRequest.branchName,
        leaveTypeName: selectedRequest.leaveTypeName,
        actionType: 'reject',
        newData: { status: 'rejected', managerComment },
        oldData: { status: 'pending' },
        note: managerComment,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });

      setIsRejectModalOpen(false);
      setIsViewModalOpen(false);
      setSelectedRequest(null);
      setManagerComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leave_requests');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu talebi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'leave_requests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leave_requests');
    }
  };

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
    doc.text('İzin Talepleri Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredRequests.map((r, index) => [
      index + 1,
      r.employeeCode,
      r.employeeName,
      r.branchName || '-',
      r.leaveTypeName,
      `${format(parseISO(r.startDate), 'dd.MM.yyyy')} - ${format(parseISO(r.endDate), 'dd.MM.yyyy')}`,
      r.leaveTypeName === 'Saatlik İzin' ? `${r.totalHours} Saat` : `${r.totalDays} Gün`,
      STATUS_OPTIONS.find(s => s.value === r.status)?.label || r.status
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'İzin Türü', 'Tarih Aralığı', 'Süre', 'Durum']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      styles: { fontSize: 9 }
    });

    doc.save(`Izin_Talepleri_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Talepleri</h1>
          <p className="text-sm text-slate-500">Personelden gelen izin taleplerini onaylayın veya reddedin.</p>
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
                  <button onClick={handlePrint} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel Ara</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Ad veya Sicil..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Şube</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Durum</label>
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Talep No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih Aralığı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Süre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right no-print">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">#{r.id.slice(-6).toUpperCase()}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{r.employeeName}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{r.employeeCode} • {r.branchName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-600">{r.leaveTypeName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-700">
                      {format(parseISO(r.startDate), 'dd MMM yyyy', { locale: tr })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {format(parseISO(r.endDate), 'dd MMM yyyy', { locale: tr })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-black text-slate-700">
                      {r.leaveTypeName === 'Saatlik İzin' ? `${r.totalHours}S` : `${r.totalDays}G`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      STATUS_OPTIONS.find(s => s.value === r.status)?.color
                    )}>
                      {STATUS_OPTIONS.find(s => s.value === r.status)?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right no-print">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedRequest(r); setIsViewModalOpen(true); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                        title="Görüntüle"
                      >
                        <Eye size={18} />
                      </button>
                      {r.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleApprove(r)}
                            className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-400 hover:text-emerald-600 transition-all"
                            title="Onayla"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button 
                            onClick={() => { setSelectedRequest(r); setIsRejectModalOpen(true); }}
                            className="p-2 hover:bg-whatsapp-50 rounded-lg text-whatsapp-400 hover:text-whatsapp-600 transition-all"
                            title="Reddet"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDelete(r.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
      {isViewModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Talep Detayı</h3>
                  <p className="text-xs text-slate-400 font-medium">#{selectedRequest.id.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 bg-whatsapp-50 border border-whatsapp-100 rounded-2xl flex items-center gap-3 text-whatsapp-600 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">{errorMessage}</p>
                </div>
              )}

              {/* Personnel Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRequest.employeeName}</p>
                  <p className="text-xs text-slate-500">{selectedRequest.employeeCode} • {selectedRequest.branchName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRequest.leaveTypeName}</p>
                  <p className="text-xs text-slate-500">Oluşturulma: {format(selectedRequest.createdAt.toDate(), 'dd.MM.yyyy HH:mm')}</p>
                </div>
              </div>

              {/* Date & Duration */}
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Başlangıç</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Calendar size={14} className="text-whatsapp-500" />
                    {format(parseISO(selectedRequest.startDate), 'dd.MM.yyyy')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitiş</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Calendar size={14} className="text-whatsapp-500" />
                    {format(parseISO(selectedRequest.endDate), 'dd.MM.yyyy')}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Süre</p>
                  <div className="flex items-center gap-2 text-sm font-black text-whatsapp-600">
                    <Clock size={14} />
                    {selectedRequest.leaveTypeName === 'Saatlik İzin' ? `${selectedRequest.totalHours} Saat` : `${selectedRequest.totalDays} Gün`}
                  </div>
                </div>
              </div>

              {/* Balance & Conflicts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Kalan İzin Hakkı</p>
                  <p className="text-lg font-black text-emerald-700">{balance ? `${balance.remainingDays} Gün` : 'Tanımlanmamış'}</p>
                </div>
                {conflicts.length > 0 ? (
                  <div className="p-4 bg-whatsapp-50 rounded-2xl border border-whatsapp-100 space-y-2">
                    <div className="flex items-center gap-2 text-whatsapp-600">
                      <AlertCircle size={14} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">Çakışan İzinler</p>
                    </div>
                    <p className="text-xs font-bold text-whatsapp-700">{conflicts.length} adet çakışma var!</p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={14} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">Çakışma Kontrolü</p>
                    </div>
                    <p className="text-xs font-bold text-emerald-700">Tarihler uygun.</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personel Notu</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed italic">
                  "{selectedRequest.note || 'Açıklama girilmemiş.'}"
                </div>
              </div>

              {/* Manager Comment (if rejected or approved) */}
              {(selectedRequest.managerComment || selectedRequest.status !== 'pending') && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Yönetici Yorumu / Onay Bilgisi</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <MessageSquare size={14} className="text-whatsapp-500" />
                      {selectedRequest.reviewedBy || 'Admin'} tarafından incelendi.
                    </div>
                    {selectedRequest.managerComment && (
                      <p className="text-sm text-slate-600 italic">"{selectedRequest.managerComment}"</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">
                Kapat
              </button>
              {selectedRequest.status === 'pending' && (
                <>
                  <button 
                    onClick={() => { setIsRejectModalOpen(true); }}
                    className="px-6 py-2.5 text-sm font-bold bg-whatsapp-50 text-whatsapp-600 hover:bg-whatsapp-100 rounded-xl transition-all"
                  >
                    Reddet
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={submitting}
                    className="px-8 py-2.5 text-sm font-bold bg-whatsapp-600 text-white hover:bg-whatsapp-700 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Onayla
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Talebi Reddet</h3>
              <p className="text-sm text-slate-500">Lütfen reddetme nedeninizi personelin görebileceği şekilde yazın.</p>
            </div>
            <textarea 
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all min-h-[120px]"
              placeholder="Örn: Belirtilen tarihlerde şube yoğunluğu nedeniyle onaylanamamıştır..."
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setIsRejectModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">
                Vazgeç
              </button>
              <button 
                onClick={handleReject}
                disabled={submitting || !managerComment.trim()}
                className="px-8 py-2.5 text-sm font-bold bg-whatsapp-600 text-white hover:bg-whatsapp-700 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
