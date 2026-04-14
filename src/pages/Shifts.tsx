import React from 'react';
import { 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader2, 
  Save,
  Moon,
  Sun,
  Coffee,
  AlertCircle
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
  updateDoc
} from 'firebase/firestore';
import { Shift } from '@/types/shifts';
import { cn } from '@/lib/utils';

export default function Shifts() {
  const [shifts, setShifts] = React.useState<Shift[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<Omit<Shift, 'id'>>({
    name: '',
    startTime: '08:00',
    endTime: '18:00',
    breakMinutes: 60,
    lateToleranceMinutes: 10,
    earlyLeaveToleranceMinutes: 10,
    overtimeAfterMinutes: 0,
    isNightShift: false,
    activeDays: [1, 2, 3, 4, 5] // Default Mon-Fri
  });

  React.useEffect(() => {
    const shiftsRef = collection(db, 'shifts');
    const q = query(shiftsRef, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Shift[];
      setShifts(shiftData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'shifts', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'shifts'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        startTime: '08:00',
        endTime: '18:00',
        breakMinutes: 60,
        lateToleranceMinutes: 10,
        earlyLeaveToleranceMinutes: 10,
        overtimeAfterMinutes: 0,
        isNightShift: false,
        activeDays: [1, 2, 3, 4, 5]
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'shifts');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      lateToleranceMinutes: shift.lateToleranceMinutes,
      earlyLeaveToleranceMinutes: shift.earlyLeaveToleranceMinutes,
      overtimeAfterMinutes: shift.overtimeAfterMinutes,
      isNightShift: shift.isNightShift,
      activeDays: shift.activeDays || [1, 2, 3, 4, 5]
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu vardiya şablonunu silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'shifts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shifts/${id}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Vardiya Şablonları</h1>
          <p className="text-slate-500">İşletmenize ait çalışma saatlerini ve toleransları tanımlayın.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              startTime: '08:00',
              endTime: '18:00',
              breakMinutes: 60,
              lateToleranceMinutes: 10,
              earlyLeaveToleranceMinutes: 10,
              overtimeAfterMinutes: 0,
              isNightShift: false,
              activeDays: [1, 2, 3, 4, 5]
            });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={20} />
          <span>Yeni Şablon Ekle</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
          <Loader2 className="animate-spin text-whatsapp-600" size={32} />
          <p className="font-medium">Şablonlar yükleniyor...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="p-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Henüz Şablon Eklenmemiş</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Personellerin çalışma saatlerini belirlemek için en az bir vardiya şablonu eklemelisiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden group hover:border-whatsapp-200 hover:shadow-xl hover:shadow-whatsapp-600/5 transition-all duration-500 flex flex-col">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      shift.isNightShift ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {shift.isNightShift ? <Moon size={24} /> : <Sun size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{shift.name}</h3>
                      <p className="text-sm text-slate-500">{shift.isNightShift ? 'Gece Vardiyası' : 'Gündüz Vardiyası'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(shift)}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-whatsapp-600 transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(shift.id)}
                      className="p-2 hover:bg-whatsapp-50 rounded-xl text-slate-400 hover:text-whatsapp-600 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">BAŞLANGIÇ</p>
                    <p className="text-lg font-bold text-slate-700">{shift.startTime}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">BİTİŞ</p>
                    <p className="text-lg font-bold text-slate-700">{shift.endTime}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Coffee size={16} />
                      <span>Mola Süresi</span>
                    </div>
                    <span className="font-bold text-slate-700">{shift.breakMinutes} dk</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertCircle size={16} />
                      <span>Geç Kalma Toleransı</span>
                    </div>
                    <span className="font-bold text-amber-600">{shift.lateToleranceMinutes} dk</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertCircle size={16} />
                      <span>Erken Çıkış Toleransı</span>
                    </div>
                    <span className="font-bold text-whatsapp-600">{shift.earlyLeaveToleranceMinutes} dk</span>
                  </div>
                  <div className="pt-2 border-t border-slate-50">
                    <div className="flex flex-wrap gap-1">
                      {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((day, idx) => {
                        const dayId = idx === 6 ? 0 : idx + 1;
                        const isActive = shift.activeDays?.includes(dayId);
                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all",
                              isActive ? "bg-whatsapp-600 text-white" : "bg-slate-100 text-slate-400"
                            )}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Şablonu Düzenle' : 'Yeni Şablon Ekle'}</h2>
                <p className="text-sm text-slate-500 mt-1">Vardiya saatlerini ve kurallarını belirleyin.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Şablon Adı</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  placeholder="Örn: Sabah Vardiyası"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Başlangıç Saati</label>
                  <input 
                    type="time"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Bitiş Saati</label>
                  <input 
                    type="time"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Mola Süresi (Dakika)</label>
                  <input 
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.breakMinutes}
                    onChange={(e) => setFormData({ ...formData, breakMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Gece Vardiyası mı?</label>
                  <div className="flex items-center gap-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isNightShift: !formData.isNightShift })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        formData.isNightShift ? "bg-whatsapp-600" : "bg-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.isNightShift ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                    <span className="text-sm text-slate-600 font-medium">{formData.isNightShift ? 'Evet' : 'Hayır'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Geç Kalma Toleransı (dk)</label>
                  <input 
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.lateToleranceMinutes}
                    onChange={(e) => setFormData({ ...formData, lateToleranceMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Erken Çıkış Toleransı (dk)</label>
                  <input 
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.earlyLeaveToleranceMinutes}
                    onChange={(e) => setFormData({ ...formData, earlyLeaveToleranceMinutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 ml-1">Varsayılan Çalışma Günleri</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 1, label: 'Pzt' },
                    { id: 2, label: 'Sal' },
                    { id: 3, label: 'Çar' },
                    { id: 4, label: 'Per' },
                    { id: 5, label: 'Cum' },
                    { id: 6, label: 'Cmt' },
                    { id: 0, label: 'Paz' }
                  ].map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        const newDays = formData.activeDays.includes(day.id)
                          ? formData.activeDays.filter(d => d !== day.id)
                          : [...formData.activeDays, day.id];
                        setFormData({ ...formData, activeDays: newDays });
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        formData.activeDays.includes(day.id)
                          ? "bg-whatsapp-600 border-whatsapp-600 text-white shadow-lg shadow-whatsapp-600/20"
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
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
                  <span>{editingId ? 'Güncelle' : 'Şablonu Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
