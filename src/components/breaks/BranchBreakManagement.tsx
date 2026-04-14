import React from 'react';
import { 
  Building2, 
  Plus, 
  Clock, 
  Trash2, 
  Edit2, 
  X, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Coffee,
  UtensilsCrossed,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { BranchBreak } from '@/types/breaks';

interface Branch {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  name: string;
}

export default function BranchBreakManagement() {
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [shifts, setShifts] = React.useState<Shift[]>([]);
  const [branchBreaks, setBranchBreaks] = React.useState<BranchBreak[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingBreak, setEditingBreak] = React.useState<BranchBreak | null>(null);

  const [formData, setFormData] = React.useState({
    branchId: '',
    shiftId: '',
    type: 'Çay Molası' as 'Çay Molası' | 'Yemek Molası',
    startTime: '10:00',
    endTime: '10:15',
    isActive: true
  });

  React.useEffect(() => {
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    const unsubBreaks = onSnapshot(collection(db, 'branch_breaks'), (snap) => {
      setBranchBreaks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchBreak)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branch_breaks');
      setLoading(false);
    });

    return () => {
      unsubBranches();
      unsubShifts();
      unsubBreaks();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Check for overlaps in the same branch/shift
      const overlaps = branchBreaks.filter(b => 
        b.branchId === formData.branchId && 
        b.shiftId === formData.shiftId &&
        b.id !== editingBreak?.id &&
        ((formData.startTime >= b.startTime && formData.startTime < b.endTime) ||
         (formData.endTime > b.startTime && formData.endTime <= b.endTime))
      );

      if (overlaps.length > 0) {
        alert('Bu saat aralığında zaten bir mola tanımlı.');
        setSubmitting(false);
        return;
      }

      if (editingBreak) {
        await updateDoc(doc(db, 'branch_breaks', editingBreak.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'branch_breaks'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingBreak(null);
      setFormData({
        branchId: '',
        shiftId: '',
        type: 'Çay Molası',
        startTime: '10:00',
        endTime: '10:15',
        isActive: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'branch_breaks');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu mola tanımını silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'branch_breaks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'branch_breaks');
    }
  };

  const toggleActive = async (b: BranchBreak) => {
    try {
      await updateDoc(doc(db, 'branch_breaks', b.id), {
        isActive: !b.isActive,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'branch_breaks');
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Şube Bazlı Mola Tanımları</h2>
        <button
          onClick={() => {
            setEditingBreak(null);
            setFormData({
              branchId: '',
              shiftId: '',
              type: 'Çay Molası',
              startTime: '10:00',
              endTime: '10:15',
              isActive: true
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={18} />
          <span>Yeni Mola Tanımla</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map(branch => {
          const branchBreaksList = branchBreaks.filter(b => b.branchId === branch.id);
          
          return (
            <div key={branch.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-whatsapp-600 shadow-sm">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{branch.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {branchBreaksList.length} Mola Tanımlı
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {branchBreaksList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 italic text-sm">
                    Henüz mola tanımlanmamış.
                  </div>
                ) : (
                  branchBreaksList.map(b => (
                    <div key={b.id} className="group relative bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-100 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center",
                            b.type === 'Yemek Molası' ? "bg-amber-100 text-amber-600" : "bg-whatsapp-100 text-whatsapp-600"
                          )}>
                            {b.type === 'Yemek Molası' ? <UtensilsCrossed size={16} /> : <Coffee size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-700">{b.type}</span>
                              {!b.isActive && (
                                <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-black uppercase">Pasif</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500 font-bold">
                              <Clock size={12} />
                              <span>{b.startTime} - {b.endTime}</span>
                              {b.shiftId && (
                                <span className="ml-1 text-whatsapp-500">
                                  ({shifts.find(s => s.id === b.shiftId)?.name})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleActive(b)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              b.isActive ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-200"
                            )}
                            title={b.isActive ? "Pasif Yap" : "Aktif Yap"}
                          >
                            {b.isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingBreak(b);
                              setFormData({
                                branchId: b.branchId,
                                shiftId: b.shiftId || '',
                                type: b.type,
                                startTime: b.startTime,
                                endTime: b.endTime,
                                isActive: b.isActive
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-whatsapp-600 hover:bg-whatsapp-50 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="p-1.5 text-slate-400 hover:text-whatsapp-600 hover:bg-whatsapp-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingBreak ? 'Mola Tanımını Düzenle' : 'Yeni Mola Tanımla'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Şube Seçimi</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Şube Seçiniz...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Vardiya (Opsiyonel)</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                  >
                    <option value="">Tüm Vardiyalar</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Mola Türü</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'Çay Molası' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-all font-bold",
                        formData.type === 'Çay Molası' 
                          ? "bg-whatsapp-50 border-whatsapp-500 text-whatsapp-600" 
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      <Coffee size={18} />
                      <span>Çay Molası</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'Yemek Molası' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-all font-bold",
                        formData.type === 'Yemek Molası' 
                          ? "bg-amber-50 border-amber-500 text-amber-600" 
                          : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      <UtensilsCrossed size={18} />
                      <span>Yemek Molası</span>
                    </button>
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bitiş Saati</label>
                    <input 
                      type="time"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-whatsapp-600 shadow-sm">
                    <Settings2 size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-700">Aktif Durumu</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Mola tanımı şu an aktif mi?</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  <span>{editingBreak ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
