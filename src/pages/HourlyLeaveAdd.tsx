import React from 'react';
import { 
  UserPlus, 
  Calendar, 
  Clock, 
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
  RefreshCw,
  Upload
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
import { LeaveRecord, LeaveBalance, LeaveChangeLog } from '@/types/leaves';
import { format, parse, differenceInMinutes, isWithinInterval, parseISO } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const LEAVE_TYPES = [
  'Saatlik İzin',
  'Özel İzin (Saatlik)',
  'Doktor Randevusu',
  'Veli İzni'
];

export default function HourlyLeaveAdd() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<LeaveRecord[]>([]);
  
  // Form state
  const [formData, setFormData] = React.useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    leaveTypeName: 'Saatlik İzin',
    shortDescription: '',
    note: '',
    documentUrl: '',
    reflectToPayroll: true,
    status: 'approved' as 'pending' | 'approved' | 'rejected' | 'cancelled'
  });

  const [totalHours, setTotalHours] = React.useState(1);
  const [existingRecord, setExistingRecord] = React.useState<LeaveRecord | null>(null);

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

  // Fetch record if editId is provided
  React.useEffect(() => {
    if (!editId) return;

    const fetchEditRecord = async () => {
      const docRef = doc(db, 'leave_records', editId);
      const snap = await getDocs(query(collection(db, 'leave_records'), where('__name__', '==', editId)));
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as LeaveRecord;
        if (data.isHourly) {
          setExistingRecord(data);
          setFormData({
            employeeId: data.employeeId,
            date: data.startDate,
            startTime: data.startTime || '09:00',
            endTime: data.endTime || '10:00',
            leaveTypeName: data.leaveTypeName,
            shortDescription: data.shortDescription,
            note: data.note,
            documentUrl: data.documentUrl || '',
            reflectToPayroll: data.reflectToPayroll,
            status: data.status
          });
        }
      }
    };

    fetchEditRecord();
  }, [editId]);

  // Calculate total hours
  React.useEffect(() => {
    try {
      const start = parse(formData.startTime, 'HH:mm', new Date());
      const end = parse(formData.endTime, 'HH:mm', new Date());
      const diffMinutes = differenceInMinutes(end, start);
      
      if (diffMinutes > 0) {
        setTotalHours(Number((diffMinutes / 60).toFixed(2)));
      } else {
        setTotalHours(0);
      }
    } catch (e) {
      setTotalHours(0);
    }
  }, [formData.startTime, formData.endTime]);

  // Conflict check
  React.useEffect(() => {
    if (!formData.employeeId || !formData.date) return;

    const checkConflicts = async () => {
      const recordsRef = collection(db, 'leave_records');
      const q = query(
        recordsRef,
        where('employeeId', '==', formData.employeeId),
        where('startDate', '==', formData.date),
        where('status', 'in', ['pending', 'approved'])
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord));
      
      // Filter out current record if editing
      const otherRecords = allRecords.filter(r => r.id !== editId);
      
      const overlapping = otherRecords.filter(r => {
        if (!r.startTime || !r.endTime) return true; // Full day leave on same day is a conflict
        
        const newStart = formData.startTime;
        const newEnd = formData.endTime;
        const existingStart = r.startTime;
        const existingEnd = r.endTime;

        return (newStart < existingEnd && newEnd > existingStart);
      });

      setConflicts(overlapping);
    };

    checkConflicts();
  }, [formData.employeeId, formData.date, formData.startTime, formData.endTime, editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || totalHours <= 0) return;
    if (conflicts.length > 0) {
      if (!window.confirm('Seçilen saat aralığında çakışan kayıtlar var. Devam etmek istiyor musunuz?')) return;
    }

    setSubmitting(true);
    try {
      const recordData: Partial<LeaveRecord> = {
        employeeId: formData.employeeId,
        employeeName: selectedEmployee?.name || '',
        employeeCode: selectedEmployee?.employeeCode || '',
        leaveTypeName: formData.leaveTypeName,
        startDate: formData.date,
        endDate: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        totalDays: 0,
        totalHours: totalHours,
        isHourly: true,
        shortDescription: formData.shortDescription,
        note: formData.note,
        documentUrl: formData.documentUrl,
        reflectToPayroll: formData.reflectToPayroll,
        status: formData.status,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
      };

      if (!existingRecord) {
        recordData.createdAt = serverTimestamp() as Timestamp;
      }

      let recordId = editId || '';
      if (editId) {
        await updateDoc(doc(db, 'leave_records', editId), recordData);
      } else {
        const docRef = await addDoc(collection(db, 'leave_records'), recordData);
        recordId = docRef.id;
      }

      // Update Leave Balance (usedHours)
      const year = parseInt(formData.date.split('-')[0]);
      const balanceRef = collection(db, 'leave_balances');
      const bQuery = query(
        balanceRef,
        where('employeeId', '==', formData.employeeId),
        where('year', '==', year),
        where('leaveTypeName', '==', 'Saatlik İzin')
      );
      const bSnap = await getDocs(bQuery);
      
      if (!bSnap.empty) {
        const balanceDoc = bSnap.docs[0];
        const currentUsedHours = balanceDoc.data().usedHours || 0;
        
        // If editing, we need to subtract the old hours first
        const oldHours = existingRecord?.totalHours || 0;
        const newUsedHours = currentUsedHours - oldHours + totalHours;
        
        await updateDoc(doc(db, 'leave_balances', balanceDoc.id), {
          usedHours: newUsedHours,
          updatedAt: serverTimestamp()
        });
      }

      // Log change
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: recordId,
        employeeId: formData.employeeId,
        employeeName: selectedEmployee?.name || '',
        employeeCode: selectedEmployee?.employeeCode || '',
        branchName: selectedBranch?.name || '',
        leaveTypeName: formData.leaveTypeName,
        actionType: editId ? 'update' : 'create',
        newData: recordData,
        oldData: existingRecord || null,
        note: formData.note,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });

      navigate('/leaves/hourly/list');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_records');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Saatlik İzin Formu', 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const data = [
      ['Sicil No', selectedEmployee?.employeeCode || '-'],
      ['Personel Adı', selectedEmployee?.name || '-'],
      ['Şube', selectedBranch?.name || '-'],
      ['İzin Tarihi', formData.date],
      ['Saat Aralığı', `${formData.startTime} - ${formData.endTime}`],
      ['Toplam Süre', `${totalHours} Saat`],
      ['İzin Türü', formData.leaveTypeName],
      ['Kısa Açıklama', formData.shortDescription || '-'],
      ['Not', formData.note || '-'],
      ['Puantaj Etkisi', formData.reflectToPayroll ? 'Evet' : 'Hayır'],
      ['Durum', formData.status === 'approved' ? 'Onaylandı' : formData.status === 'pending' ? 'Beklemede' : 'Reddedildi']
    ];

    autoTable(doc, {
      startY: 40,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 50 } }
    });

    doc.save(`Saatlik_Izin_${selectedEmployee?.employeeCode || 'Yeni'}_${formData.date}.pdf`);
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {editId ? 'Saatlik İzni Düzenle' : 'Saatlik İzin Ekle'}
          </h1>
          <p className="text-sm text-slate-500">Personel için saat bazlı izin kaydı oluşturun.</p>
        </div>
        <button 
          onClick={() => navigate('/leaves/hourly/list')}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            {/* Personnel Selection */}
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
                    disabled={!!editId}
                  >
                    <option value="">Personel Seçiniz...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
              </div>

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
                    {LEAVE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tarih</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Başlangıç Saati</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="time"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bitiş Saati</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="time"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Total & Description */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-whatsapp-100 text-whatsapp-600 flex items-center justify-center shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hesaplanan Süre</p>
                  <p className="text-xl font-black text-slate-800">{totalHours} Saat</p>
                </div>
                {totalHours <= 0 && (
                  <div className="ml-auto flex items-center gap-2 text-whatsapp-600 animate-pulse">
                    <AlertCircle size={18} />
                    <span className="text-xs font-bold">Geçersiz Saat Aralığı</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kısa Açıklama</label>
                <input 
                  type="text"
                  placeholder="Örn: Hastane Randevusu, Okul Toplantısı vb."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Açıklama / Not</label>
                <textarea 
                  rows={4}
                  placeholder="Detaylı açıklama giriniz..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all resize-none"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Belge Bağlantısı (Opsiyonel)</label>
                <div className="relative">
                  <Upload className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="url"
                    placeholder="https://example.com/belge.pdf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.documentUrl}
                    onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Personnel Info Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Info size={18} className="text-whatsapp-500" />
              Personel Bilgileri
            </h3>
            {selectedEmployee ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</p>
                  <p className="text-sm font-bold text-slate-700">{selectedEmployee.employeeCode}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube</p>
                  <p className="text-sm font-bold text-slate-700">{selectedBranch?.name || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Personel seçildiğinde bilgiler burada görünecektir.</p>
            )}
          </div>

          {/* Settings Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw size={18} className="text-whatsapp-500" />
              İşlem Ayarları
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-600">Puantaja Etki</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formData.reflectToPayroll}
                    onChange={(e) => setFormData({ ...formData, reflectToPayroll: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-600"></div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Onay Durumu</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="pending">Beklemede</option>
                  <option value="approved">Onaylandı</option>
                  <option value="rejected">Reddedildi</option>
                  <option value="cancelled">İptal Edildi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Conflict Warning */}
          {conflicts.length > 0 && (
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 space-y-3 animate-pulse">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle size={20} />
                <h4 className="text-sm font-bold">Çakışan Kayıtlar!</h4>
              </div>
              <div className="space-y-2">
                {conflicts.map(c => (
                  <div key={c.id} className="text-[10px] font-medium text-amber-600 bg-white/50 p-2 rounded-lg border border-amber-100">
                    {c.startDate} | {c.startTime}-{c.endTime} | {c.leaveTypeName}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              type="submit"
              disabled={submitting || totalHours <= 0}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span>{editId ? 'Değişiklikleri Kaydet' : 'İzni Kaydet'}</span>
            </button>
            <button 
              type="button"
              onClick={handlePrint}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-slate-800/20 flex items-center justify-center gap-2"
            >
              <Printer size={20} />
              <span>Yazdır / PDF</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setFormData({
                  employeeId: '',
                  date: format(new Date(), 'yyyy-MM-dd'),
                  startTime: '09:00',
                  endTime: '10:00',
                  leaveTypeName: 'Saatlik İzin',
                  shortDescription: '',
                  note: '',
                  reflectToPayroll: true,
                  status: 'approved'
                });
                setExistingRecord(null);
                navigate('/leaves/hourly/add', { replace: true });
              }}
              className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-4 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={20} />
              <span>Formu Temizle</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
