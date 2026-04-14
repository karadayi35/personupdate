import React from 'react';
import { 
  UserPlus, 
  Calendar, 
  Clock, 
  FileText, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Loader2,
  ArrowRight,
  Save,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  where,
  getDocs,
  Timestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { LeaveRecord, LeaveBalance, LeaveChangeLog } from '@/types/leaves';
import { format, differenceInDays, parseISO, isWithinInterval, differenceInHours, parse } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  branchId: string;
}

const LEAVE_TYPES = [
  { name: 'Yıllık İzin', isHourly: false },
  { name: 'Ücretli İzin', isHourly: false },
  { name: 'Ücretsiz İzin', isHourly: false },
  { name: 'Raporlu', isHourly: false },
  { name: 'Babalık İzni', isHourly: false },
  { name: 'Doğum İzni', isHourly: false },
  { name: 'Mazeret ve Diğer Ücretli İzinler', isHourly: false },
  { name: 'Saatlik İzin', isHourly: true }
];

export default function LeavesAdd() {
  const navigate = useNavigate();
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [balance, setBalance] = React.useState<LeaveBalance | null>(null);
  const [conflicts, setConflicts] = React.useState<LeaveRecord[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Form state
  const [formData, setFormData] = React.useState({
    employeeId: '',
    leaveTypeName: 'Yıllık İzin',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '18:00',
    shortDescription: '',
    note: '',
    status: 'approved' as const,
    reflectToPayroll: true,
  });

  const [calculatedDays, setCalculatedDays] = React.useState(1);
  const [calculatedHours, setCalculatedHours] = React.useState(0);

  const isHourly = LEAVE_TYPES.find(t => t.name === formData.leaveTypeName)?.isHourly;

  React.useEffect(() => {
    const employeesRef = collection(db, 'employees');
    const unsubscribe = onSnapshot(employeesRef, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch balance and check conflicts when employee or dates change
  React.useEffect(() => {
    if (!formData.employeeId) {
      setBalance(null);
      setConflicts([]);
      return;
    }

    const fetchData = async () => {
      // Fetch Balance
      const balanceRef = collection(db, 'leave_balances');
      const bQuery = query(
        balanceRef, 
        where('employeeId', '==', formData.employeeId),
        where('year', '==', new Date().getFullYear())
      );
      const bSnap = await getDocs(bQuery);
      if (!bSnap.empty) {
        setBalance({ id: bSnap.docs[0].id, ...bSnap.docs[0].data() } as LeaveBalance);
      } else {
        setBalance(null);
      }

      // Check Conflicts
      const leavesRef = collection(db, 'leave_records');
      const cQuery = query(
        leavesRef,
        where('employeeId', '==', formData.employeeId),
        where('status', 'in', ['approved', 'pending'])
      );
      const cSnap = await getDocs(cQuery);
      const allLeaves = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord));
      
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);

      const overlapping = allLeaves.filter(l => {
        const lStart = parseISO(l.startDate);
        const lEnd = parseISO(l.endDate);
        return (
          isWithinInterval(start, { start: lStart, end: lEnd }) ||
          isWithinInterval(end, { start: lStart, end: lEnd }) ||
          isWithinInterval(lStart, { start, end })
        );
      });
      setConflicts(overlapping);
    };

    fetchData();
    setSelectedEmployee(employees.find(e => e.id === formData.employeeId) || null);
  }, [formData.employeeId, formData.startDate, formData.endDate, employees]);

  // Recalculate days/hours
  React.useEffect(() => {
    const start = parseISO(formData.startDate);
    const end = parseISO(formData.endDate);
    
    if (isHourly) {
      const sTime = parse(formData.startTime, 'HH:mm', new Date());
      const eTime = parse(formData.endTime, 'HH:mm', new Date());
      const hours = differenceInHours(eTime, sTime);
      setCalculatedHours(hours > 0 ? hours : 0);
      setCalculatedDays(0);
    } else {
      const days = differenceInDays(end, start) + 1;
      setCalculatedDays(days > 0 ? days : 0);
      setCalculatedHours(0);
    }
  }, [formData.startDate, formData.endDate, formData.startTime, formData.endTime, isHourly]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) return;
    if (conflicts.length > 0) {
      alert('Seçilen tarih aralığında çakışan izinler var!');
      return;
    }

    setSubmitting(true);
    try {
      const leaveData: Partial<LeaveRecord> = {
        ...formData,
        employeeName: selectedEmployee?.name || '',
        employeeCode: selectedEmployee?.employeeCode || '',
        totalDays: calculatedDays,
        totalHours: calculatedHours,
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      const docRef = await addDoc(collection(db, 'leave_records'), leaveData);
      
      // Create Change Log
      await addDoc(collection(db, 'leave_change_logs'), {
        leaveRecordId: docRef.id,
        actionType: 'create',
        newData: leaveData,
        changedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        changedAt: serverTimestamp(),
      });

      // Update balance if approved and not hourly
      if (formData.status === 'approved' && !isHourly && balance) {
        const balanceRef = doc(db, 'leave_balances', balance.id);
        await updateDoc(balanceRef, {
          usedDays: (balance.usedDays || 0) + calculatedDays,
          remainingDays: (balance.remainingDays || 0) - calculatedDays,
        });
      }

      navigate('/leaves/list');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leave_records');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İzin Tanımla</h1>
          <p className="text-sm text-slate-500">Personel için yeni bir izin kaydı oluşturun ve bakiyesini kontrol edin.</p>
        </div>
        <button 
          onClick={() => navigate('/leaves/list')}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            {/* Section: Personnel & Type */}
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
                      <option key={type.name} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Dates & Times */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Başlangıç Tarihi</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: isHourly ? e.target.value : formData.endDate })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bitiş Tarihi</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="date"
                      required
                      disabled={isHourly}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all disabled:opacity-50"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {isHourly && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
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
              )}
            </div>

            {/* Section: Description & Notes */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kısa Açıklama</label>
                <input 
                  type="text"
                  placeholder="Örn: Yıllık tatil planı"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Detaylı Notlar</label>
                <textarea 
                  placeholder="İzin hakkında eklemek istediğiniz detaylar..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-medium focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all min-h-[120px]"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>

            {/* Section: Document Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Belge Yükleme</label>
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-whatsapp-300 hover:bg-whatsapp-50/30 transition-all cursor-pointer group">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-whatsapp-500 group-hover:bg-whatsapp-100 transition-all">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Dosya seçin veya buraya sürükleyin</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, JPG veya PNG (Maks. 5MB)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Options & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox"
                  id="reflectToPayroll"
                  className="w-5 h-5 rounded border-slate-300 text-whatsapp-600 focus:ring-whatsapp-500"
                  checked={formData.reflectToPayroll}
                  onChange={(e) => setFormData({ ...formData, reflectToPayroll: e.target.checked })}
                />
                <label htmlFor="reflectToPayroll" className="text-sm font-bold text-slate-700 cursor-pointer">
                  Puantaja Yansıtılsın
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Durum / Onay Bilgisi</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all appearance-none"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="approved">Onaylandı</option>
                  <option value="pending">Beklemede</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Controls */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Info size={20} className="text-whatsapp-500" />
              İzin Özeti
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-whatsapp-50 rounded-2xl border border-whatsapp-100">
                <span className="text-sm font-bold text-whatsapp-700">Hesaplanan Süre</span>
                <span className="text-lg font-black text-whatsapp-600">
                  {isHourly ? `${calculatedHours} Saat` : `${calculatedDays} Gün`}
                </span>
              </div>

              {selectedEmployee && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kalan İzin Hakkı</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Yıllık İzin Bakiyesi</span>
                    <span className={cn(
                      "text-sm font-bold",
                      (balance?.remainingDays || 0) < calculatedDays ? "text-whatsapp-600" : "text-emerald-600"
                    )}>
                      {balance ? `${balance.remainingDays} Gün` : 'Tanımlanmamış'}
                    </span>
                  </div>
                </div>
              )}

              {/* Conflict Alert */}
              {conflicts.length > 0 && (
                <div className="p-4 bg-whatsapp-50 rounded-2xl border border-whatsapp-200 flex gap-3 animate-pulse">
                  <AlertCircle className="text-whatsapp-600 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-whatsapp-700">Çakışan İzin Tespit Edildi!</p>
                    <p className="text-[10px] text-whatsapp-600">Bu personel için seçilen tarihlerde zaten bir kayıt bulunmaktadır.</p>
                  </div>
                </div>
              )}

              {conflicts.length === 0 && formData.employeeId && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-700">Tarihler Uygun</p>
                    <p className="text-[10px] text-emerald-600">Herhangi bir çakışma tespit edilmedi.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              type="submit"
              disabled={submitting || !formData.employeeId || conflicts.length > 0}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              <span>İzni Kaydet</span>
            </button>
            <button 
              type="button"
              onClick={() => navigate('/leaves/list')}
              className="w-full bg-white hover:bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2"
            >
              <span>İptal Et</span>
            </button>
          </div>

          {/* Tips Card */}
          <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-4">
            <div className="flex items-center gap-2 text-whatsapp-400">
              <Info size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">Önemli Bilgi</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              İzin kaydı onaylandığında personelin yıllık izin bakiyesinden otomatik olarak düşülecektir. 
              Saatlik izinler yıllık izin bakiyesini etkilemez.
            </p>
            <div className="pt-2">
              <button className="text-[10px] font-bold text-whatsapp-400 hover:text-whatsapp-300 flex items-center gap-1 transition-colors">
                İzin Politikalarını Görüntüle
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
