import React from 'react';
import { 
  UserPlus, 
  Calendar, 
  FileText, 
  Save, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Printer, 
  FileDown,
  Info,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { LeaveBalance, LeaveRecord } from '@/types/leaves';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  branchId: string;
  hireDate?: string;
}

interface Branch {
  id: string;
  name: string;
}

const LEAVE_TYPES = [
  'Yıllık İzin',
  'Ücretli İzin',
  'Ücretsiz İzin',
  'Mazeret İzni',
  'Saatlik İzin'
];

export default function LeaveRightsAdd() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [existingBalance, setExistingBalance] = React.useState<LeaveBalance | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    employeeId: '',
    year: new Date().getFullYear(),
    leaveTypeName: 'Yıllık İzin',
    totalAllowance: 14,
    note: '',
    status: 'active' as 'active' | 'passive'
  });

  const [usedDays, setUsedDays] = React.useState(0);
  const [usedHours, setUsedHours] = React.useState(0);
  const [remainingDays, setRemainingDays] = React.useState(14);

  const selectedEmployee = employees.find(e => e.id === formData.employeeId);
  const selectedBranch = branches.find(b => b.id === selectedEmployee?.branchId);

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    });

    return () => {
      unsubEmployees();
      unsubBranches();
    };
  }, []);

  // Fetch balance if editId is provided
  React.useEffect(() => {
    if (!editId) return;

    const fetchEditBalance = async () => {
      const balanceRef = doc(db, 'leave_balances', editId);
      const bSnap = await getDocs(query(collection(db, 'leave_balances'), where('__name__', '==', editId)));
      if (!bSnap.empty) {
        const bData = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as LeaveBalance;
        setExistingBalance(bData);
        setFormData({
          employeeId: bData.employeeId,
          year: bData.year,
          leaveTypeName: bData.leaveTypeName,
          totalAllowance: bData.totalAllowance,
          note: bData.note || '',
          status: bData.status
        });
      }
    };

    fetchEditBalance();
  }, [editId]);

  // Fetch existing balance and used days when employee/year/type changes (only if not in explicit edit mode or if values change)
  React.useEffect(() => {
    if (!formData.employeeId) {
      if (!editId) {
        setExistingBalance(null);
        setUsedDays(0);
      }
      return;
    }

    const fetchData = async () => {
      // 1. Check for existing balance (only if not already editing this specific ID)
      if (!editId) {
        const balanceRef = collection(db, 'leave_balances');
        const bQuery = query(
          balanceRef,
          where('employeeId', '==', formData.employeeId),
          where('year', '==', formData.year),
          where('leaveTypeName', '==', formData.leaveTypeName)
        );
        const bSnap = await getDocs(bQuery);
        
        if (!bSnap.empty) {
          const bData = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as LeaveBalance;
          setExistingBalance(bData);
          setFormData(prev => ({ ...prev, totalAllowance: bData.totalAllowance, note: bData.note || '', status: bData.status }));
        } else {
          setExistingBalance(null);
        }
      }

      // 2. Fetch used days from approved leave records
      const recordsRef = collection(db, 'leave_records');
      const rQuery = query(
        recordsRef,
        where('employeeId', '==', formData.employeeId),
        where('leaveTypeName', '==', formData.leaveTypeName),
        where('status', '==', 'approved')
      );
      const rSnap = await getDocs(rQuery);
      const yearRecords = rSnap.docs
        .map(doc => doc.data() as LeaveRecord)
        .filter(r => r.startDate.startsWith(formData.year.toString()));
      
      const totalUsed = yearRecords.reduce((sum, r) => sum + r.totalDays, 0);
      const totalUsedHours = yearRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
      setUsedDays(totalUsed);
      setUsedHours(totalUsedHours);
    };

    fetchData();
  }, [formData.employeeId, formData.year, formData.leaveTypeName, editId]);

  // Calculate remaining days
  React.useEffect(() => {
    setRemainingDays(formData.totalAllowance - usedDays);
  }, [formData.totalAllowance, usedDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) return;

    setSubmitting(true);
    try {
      const balanceData: Partial<LeaveBalance> = {
        ...formData,
        employeeName: selectedEmployee?.name || '',
        employeeCode: selectedEmployee?.employeeCode || '',
        branchName: selectedBranch?.name || '',
        usedDays,
        usedHours,
        remainingDays,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      };

      let balanceId = '';
      if (existingBalance) {
        // Update
        const balanceRef = doc(db, 'leave_balances', existingBalance.id);
        await updateDoc(balanceRef, balanceData);
        balanceId = existingBalance.id;
      } else {
        // Create
        const docRef = await addDoc(collection(db, 'leave_balances'), {
          ...balanceData,
          createdAt: serverTimestamp() as Timestamp,
        });
        balanceId = docRef.id;
      }

      // Log change
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveBalanceId: balanceId,
        employeeId: formData.employeeId,
        employeeName: selectedEmployee?.name || '',
        employeeCode: selectedEmployee?.employeeCode || '',
        branchName: selectedBranch?.name || '',
        leaveTypeName: formData.leaveTypeName,
        actionType: existingBalance ? 'update' : 'create',
        newData: balanceData,
        oldData: existingBalance || null,
        note: formData.note,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });

      alert('İzin hakkı başarıyla kaydedildi.');
      if (!existingBalance) {
        handleReset();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_balances');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      employeeId: '',
      year: new Date().getFullYear(),
      leaveTypeName: 'Yıllık İzin',
      totalAllowance: 14,
      note: '',
      status: 'active'
    });
    setExistingBalance(null);
    setUsedDays(0);
    setRemainingDays(14);
  };

  const handleDownloadPDF = () => {
    if (!selectedEmployee) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('İzin Hakkı Tanımlama Belgesi', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const data = [
      ['Sicil No', selectedEmployee.employeeCode],
      ['Personel Adı', selectedEmployee.name],
      ['Şube', selectedBranch?.name || '-'],
      ['Yıl', formData.year.toString()],
      ['İzin Türü', formData.leaveTypeName],
      ['Toplam İzin Hakkı', `${formData.totalAllowance} Gün`],
      ['Kullanılan İzin', `${usedDays} Gün`],
      ['Kalan İzin', `${remainingDays} Gün`],
      ['Durum', formData.status === 'active' ? 'Aktif' : 'Pasif'],
      ['Not', formData.note || '-']
    ];

    autoTable(doc, {
      startY: 40,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    doc.save(`Izin_Hakki_${selectedEmployee.employeeCode}_${formData.year}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Hakkı Tanımla</h1>
          <p className="text-sm text-slate-500">Personeller için yıllık veya diğer türlerde izin haklarını yönetin.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/leaves/rights/list')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            {/* Personnel & Year */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Personel Seçimi</label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  >
                    <option value="">Personel Seçiniz...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Yıl Seçimi</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  >
                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Type & Total */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">İzin Türü</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.leaveTypeName}
                    onChange={(e) => setFormData({ ...formData, leaveTypeName: e.target.value })}
                  >
                    {LEAVE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Toplam İzin Hakkı ({formData.leaveTypeName === 'Saatlik İzin' ? 'Saat' : 'Gün'})
                </label>
                <div className="relative">
                  <RefreshCw className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number"
                    required
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.totalAllowance}
                    onChange={(e) => setFormData({ ...formData, totalAllowance: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Açıklama / Not</label>
              <textarea 
                placeholder="İzin hakkı tanımlamasıyla ilgili notlar..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all min-h-[100px]"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            {/* Status */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Durum:</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="status"
                    className="w-4 h-4 text-whatsapp-600 focus:ring-whatsapp-500"
                    checked={formData.status === 'active'}
                    onChange={() => setFormData({ ...formData, status: 'active' })}
                  />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-whatsapp-600 transition-colors">Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="status"
                    className="w-4 h-4 text-whatsapp-600 focus:ring-whatsapp-500"
                    checked={formData.status === 'passive'}
                    onChange={() => setFormData({ ...formData, status: 'passive' })}
                  />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-whatsapp-600 transition-colors">Pasif</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Actions */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Info size={20} className="text-whatsapp-500" />
              Bakiye Özeti
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kullanılan</p>
                  <p className="text-lg font-black text-whatsapp-600">
                    {formData.leaveTypeName === 'Saatlik İzin' ? `${usedHours} Saat` : `${usedDays} Gün`}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Kalan</p>
                  <p className="text-lg font-black text-emerald-700">
                    {formData.leaveTypeName === 'Saatlik İzin' ? '-' : `${remainingDays} Gün`}
                  </p>
                </div>
              </div>

              {existingBalance && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-700">Mevcut Kayıt Düzenleniyor</p>
                    <p className="text-[10px] text-amber-600">Bu personel ve yıl için zaten bir kayıt var. Kaydederseniz güncellenecektir.</p>
                  </div>
                </div>
              )}

              {!existingBalance && formData.employeeId && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-700">Yeni Kayıt</p>
                    <p className="text-[10px] text-emerald-600">Bu personel için ilk kez izin hakkı tanımlanıyor.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              type="submit"
              disabled={submitting || !formData.employeeId}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span>{existingBalance ? 'Güncelle' : 'Kaydet'}</span>
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={handleReset}
                className="bg-white hover:bg-slate-50 text-slate-600 font-bold py-3 rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                <span>Temizle</span>
              </button>
              <button 
                type="button"
                onClick={handleDownloadPDF}
                disabled={!formData.employeeId}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-slate-800/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileDown size={18} />
                <span>PDF</span>
              </button>
            </div>

            <button 
              type="button"
              onClick={() => navigate('/leaves/rights/list')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <span>İptal</span>
            </button>
          </div>

          {/* Info Card */}
          <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-4">
            <div className="flex items-center gap-2 text-whatsapp-400">
              <Info size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Kıdem Bilgisi</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                Personelin işe giriş tarihi: <span className="text-white font-bold">{selectedEmployee?.hireDate ? format(new Date(selectedEmployee.hireDate), 'dd.MM.yyyy') : 'Belirtilmemiş'}</span>
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                * 1-5 yıl arası: 14 gün<br/>
                * 5-15 yıl arası: 20 gün<br/>
                * 15 yıl ve üzeri: 26 gün
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
