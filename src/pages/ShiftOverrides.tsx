import React from 'react';
import { 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader2, 
  Save,
  Clock,
  Search,
  Filter,
  AlertTriangle,
  CalendarDays,
  Coffee,
  Moon,
  Sun
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { ShiftOverride } from '@/types/shifts';
import { ShiftService } from '@/services/shiftService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ShiftOverrides() {
  const [overrides, setOverrides] = React.useState<ShiftOverride[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<Omit<ShiftOverride, 'id'>>({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    overrideType: 'shift_change',
    customStartTime: '08:00',
    customEndTime: '18:00',
    reason: ''
  });

  React.useEffect(() => {
    // Fetch overrides
    const overridesRef = collection(db, 'shift_overrides');
    const q = query(overridesRef, orderBy('date', 'desc'));
    const unsubscribeOverrides = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShiftOverride[];
      setOverrides(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shift_overrides');
    });

    // Fetch employees
    const employeesRef = collection(db, 'employees');
    const unsubscribeEmployees = onSnapshot(employeesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(data);
      setLoading(false);
    });

    return () => {
      unsubscribeOverrides();
      unsubscribeEmployees();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'shift_overrides', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'shift_overrides'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }

      // Trigger recalculation
      await ShiftService.recalculateForEmployeeInRange(formData.employeeId, formData.date, formData.date);

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        employeeId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        overrideType: 'shift_change',
        customStartTime: '08:00',
        customEndTime: '18:00',
        reason: ''
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'shift_overrides');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (override: ShiftOverride) => {
    setEditingId(override.id);
    setFormData({
      employeeId: override.employeeId,
      date: override.date,
      overrideType: override.overrideType,
      customStartTime: override.customStartTime || '08:00',
      customEndTime: override.customEndTime || '18:00',
      reason: override.reason || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu değişikliği silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'shift_overrides', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shift_overrides/${id}`);
    }
  };

  const getOverrideTypeLabel = (type: string) => {
    switch (type) {
      case 'shift_change': return 'Vardiya Değişimi';
      case 'day_off': return 'İzin / Tatil';
      case 'overtime': return 'Ek Mesai';
      case 'replacement': return 'Nöbet Değişimi';
      default: return type;
    }
  };

  const getOverrideTypeColor = (type: string) => {
    switch (type) {
      case 'shift_change': return 'bg-whatsapp-50 text-whatsapp-600';
      case 'day_off': return 'bg-whatsapp-50 text-whatsapp-600';
      case 'overtime': return 'bg-emerald-50 text-emerald-600';
      case 'replacement': return 'bg-amber-50 text-amber-600';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Personel veya tarih ara..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({
              employeeId: '',
              date: format(new Date(), 'yyyy-MM-dd'),
              overrideType: 'shift_change',
              customStartTime: '08:00',
              customEndTime: '18:00',
              reason: ''
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={20} />
          <span>Yeni Değişiklik</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">PERSONEL</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">TARİH</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">TÜR</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">SAATLER</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">NEDEN</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {overrides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Henüz günlük değişiklik kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                overrides.map((override) => {
                  const employee = employees.find(e => e.id === override.employeeId);
                  return (
                    <tr key={override.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${employee?.email}`} alt="" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">{employee?.name || 'Bilinmiyor'}</p>
                            <p className="text-xs text-slate-400">{employee?.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <CalendarDays size={14} className="text-slate-400" />
                          <span>{override.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          getOverrideTypeColor(override.overrideType)
                        )}>
                          {getOverrideTypeLabel(override.overrideType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {override.overrideType === 'day_off' ? (
                          <span className="text-xs text-slate-400 font-medium italic">Tüm Gün İzin</span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Clock size={14} className="text-slate-400" />
                            <span>{override.customStartTime} - {override.customEndTime}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 max-w-[200px] truncate" title={override.reason}>
                          {override.reason || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(override)}
                            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-whatsapp-600 transition-all shadow-sm"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(override.id)}
                            className="p-2 hover:bg-whatsapp-50 rounded-xl text-slate-400 hover:text-whatsapp-600 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Değişikliği Düzenle' : 'Yeni Günlük Değişiklik'}</h2>
                <p className="text-sm text-slate-500 mt-1">Belirli bir gün için vardiya kurallarını geçersiz kılın.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Personel Seçin</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  >
                    <option value="">Seçiniz...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Tarih</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Değişiklik Türü</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'shift_change', label: 'Vardiya Değişimi', icon: Clock },
                    { id: 'day_off', label: 'İzin / Tatil', icon: Coffee },
                    { id: 'overtime', label: 'Ek Mesai', icon: Sun },
                    { id: 'replacement', label: 'Nöbet Değişimi', icon: ArrowRightLeft }
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, overrideType: type.id as any })}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all border",
                        formData.overrideType === type.id
                          ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600 shadow-sm"
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {/* @ts-ignore */}
                      <type.icon size={18} />
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formData.overrideType !== 'day_off' && (
                <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Özel Başlangıç Saati</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.customStartTime}
                      onChange={(e) => setFormData({ ...formData, customStartTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Özel Bitiş Saati</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.customEndTime}
                      onChange={(e) => setFormData({ ...formData, customEndTime: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Açıklama / Neden</label>
                <textarea 
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all resize-none"
                  placeholder="Değişiklik nedenini belirtin..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  <span>{editingId ? 'Güncelle' : 'Değişikliği Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const ArrowRightLeft = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
  </svg>
);
