import React from 'react';
import { 
  Settings2, 
  Users, 
  Calendar, 
  Clock, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  writeBatch,
  doc
} from 'firebase/firestore';
import { Shift } from '@/types/shifts';
import { ShiftService } from '@/services/shiftService';
import { cn } from '@/lib/utils';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

export default function BulkShiftActions() {
  const [branches, setBranches] = React.useState<any[]>([]);
  const [shifts, setShifts] = React.useState<Shift[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [result, setResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    branchId: 'all',
    shiftId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    actionType: 'override' as 'override' | 'assignment'
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const branchesSnap = await getDocs(collection(db, 'branches'));
        setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        setShifts(shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleBulkAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shiftId) return;

    setProcessing(true);
    setResult(null);

    try {
      // 1. Get target employees
      let employeesQuery = collection(db, 'employees');
      if (formData.branchId !== 'all') {
        // @ts-ignore
        employeesQuery = query(employeesQuery, where('branchId', '==', formData.branchId));
      }
      const employeesSnap = await getDocs(employeesQuery);
      const employeeIds = employeesSnap.docs.map(doc => doc.id);

      if (employeeIds.length === 0) {
        setResult({ success: false, message: 'Seçili kriterlere uygun personel bulunamadı.' });
        return;
      }

      const batch = writeBatch(db);
      const days = eachDayOfInterval({
        start: parseISO(formData.startDate),
        end: parseISO(formData.endDate)
      });

      const shift = shifts.find(s => s.id === formData.shiftId);

      if (formData.actionType === 'override') {
        // Create overrides for each employee and each day
        for (const employeeId of employeeIds) {
          for (const day of days) {
            const dateStr = format(day, 'yyyy-MM-dd');
            const overrideRef = doc(collection(db, 'shift_overrides'));
            batch.set(overrideRef, {
              employeeId,
              date: dateStr,
              overrideType: 'shift_change',
              customStartTime: shift?.startTime,
              customEndTime: shift?.endTime,
              reason: 'Toplu Vardiya Ataması',
              createdAt: serverTimestamp()
            });
          }
        }
      } else {
        // Create assignments
        for (const employeeId of employeeIds) {
          const assignmentRef = doc(collection(db, 'employee_shift_assignments'));
          batch.set(assignmentRef, {
            employeeId,
            shiftId: formData.shiftId,
            startDate: formData.startDate,
            endDate: formData.endDate,
            repeatType: 'daily',
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            isActive: true,
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      
      // 2. Trigger recalculation for the date range
      if (formData.branchId === 'all') {
        await ShiftService.recalculateAllInRange(formData.startDate, formData.endDate);
      } else {
        for (const employeeId of employeeIds) {
          await ShiftService.recalculateForEmployeeInRange(employeeId, formData.startDate, formData.endDate);
        }
      }

      setResult({ 
        success: true, 
        message: `${employeeIds.length} personel için ${days.length} günlük işlem başarıyla tamamlandı ve veriler yeniden hesaplandı.` 
      });
    } catch (error) {
      console.error('Bulk action error:', error);
      setResult({ success: false, message: 'İşlem sırasında bir hata oluştu.' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
        <Loader2 className="animate-spin text-whatsapp-600" size={32} />
        <p className="font-medium">Veriler hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-whatsapp-600 text-white rounded-2xl shadow-lg shadow-whatsapp-600/20">
              <Settings2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Toplu Vardiya İşlemleri</h2>
              <p className="text-sm text-slate-500 mt-1">Birden fazla personel için aynı anda vardiya veya override tanımlayın.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleBulkAction} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Target Selection */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} />
                Hedef Kitle
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Şube / Birim</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="all">Tüm Şubeler</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">İşlem Türü</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, actionType: 'override' })}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                        formData.actionType === 'override'
                          ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      Günlük Override
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, actionType: 'assignment' })}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                        formData.actionType === 'assignment'
                          ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      Kalıcı Atama
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic ml-1">
                    {formData.actionType === 'override' 
                      ? 'Seçili tarihler için mevcut vardiyayı geçersiz kılar.' 
                      : 'Personelin ana vardiya düzenini değiştirir.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shift & Date Selection */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} />
                Vardiya ve Zaman
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Uygulanacak Vardiya</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                  >
                    <option value="">Vardiya Seçiniz...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Başlangıç</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Bitiş</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className={cn(
              "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
              result.success ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-whatsapp-50 text-whatsapp-700 border border-whatsapp-100"
            )}>
              {result.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-bold">{result.message}</p>
            </div>
          )}

          <div className="pt-4">
            <button 
              type="submit"
              disabled={processing || !formData.shiftId}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-whatsapp-600/20 flex items-center justify-center gap-3"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  <span>İşleniyor...</span>
                </>
              ) : (
                <>
                  <Settings2 size={24} />
                  <span>Toplu İşlemi Başlat</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">Dikkat: Geri Alınamaz İşlem</h4>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            Toplu işlemler seçili tarih aralığındaki tüm personellerin vardiya düzenini etkiler. 
            İşlemi başlatmadan önce tarihleri ve seçili şubeyi kontrol ettiğinizden emin olun.
          </p>
        </div>
      </div>
    </div>
  );
}
