import React from 'react';
import { 
  User, 
  Plus, 
  Clock, 
  Trash2, 
  Edit2, 
  X, 
  Loader2, 
  AlertCircle,
  Calendar,
  Search,
  Building2,
  Coffee,
  UtensilsCrossed,
  Ban
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
  where,
  orderBy
} from 'firebase/firestore';
import { BranchBreak, EmployeeBreakOverride } from '@/types/breaks';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

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

export default function EmployeeBreakOverrides() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [branchBreaks, setBranchBreaks] = React.useState<BranchBreak[]>([]);
  const [overrides, setOverrides] = React.useState<EmployeeBreakOverride[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingOverride, setEditingOverride] = React.useState<EmployeeBreakOverride | null>(null);

  const [formData, setFormData] = React.useState({
    employeeId: '',
    branchBreakId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    customStartTime: '',
    customEndTime: '',
    isExcluded: false
  });

  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });

    const unsubBranchBreaks = onSnapshot(collection(db, 'branch_breaks'), (snap) => {
      setBranchBreaks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchBreak)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branch_breaks');
    });

    const unsubOverrides = onSnapshot(query(collection(db, 'employee_break_overrides'), orderBy('date', 'desc')), (snap) => {
      setOverrides(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeBreakOverride)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employee_break_overrides');
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubBranches();
      unsubBranchBreaks();
      unsubOverrides();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingOverride) {
        await updateDoc(doc(db, 'employee_break_overrides', editingOverride.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'employee_break_overrides'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingOverride(null);
      setFormData({
        employeeId: '',
        branchBreakId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        customStartTime: '',
        customEndTime: '',
        isExcluded: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employee_break_overrides');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu istisnayı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'employee_break_overrides', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employee_break_overrides');
    }
  };

  const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.name || 'Bilinmiyor';
  const getBranchBreakInfo = (id: string) => {
    const b = branchBreaks.find(bb => bb.id === id);
    if (!b) return 'Bilinmiyor';
    const branch = branches.find(br => br.id === b.branchId);
    return `${branch?.name || '-'} | ${b.type} (${b.startTime}-${b.endTime})`;
  };

  const filteredOverrides = overrides.filter(o => {
    const empName = getEmployeeName(o.employeeId).toLowerCase();
    return empName.includes(searchTerm.toLowerCase());
  });

  const selectedEmployee = employees.find(e => e.id === formData.employeeId);
  const availableBreaks = branchBreaks.filter(b => b.branchId === selectedEmployee?.branchId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800">Personel Bazlı Mola İstisnaları</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Personel ara..."
              className="bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setEditingOverride(null);
              setFormData({
                employeeId: '',
                branchBreakId: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                customStartTime: '',
                customEndTime: '',
                isExcluded: false
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
          >
            <Plus size={18} />
            <span>Yeni İstisna Ekle</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mola Tanımı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İstisna Durumu</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOverrides.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{getEmployeeName(o.employeeId)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">
                    {format(parseISO(o.date), 'dd MMM yyyy', { locale: tr })}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {getBranchBreakInfo(o.branchBreakId)}
                  </td>
                  <td className="px-6 py-4">
                    {o.isExcluded ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-whatsapp-50 text-whatsapp-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <Ban size={12} />
                        Mola İptal
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-whatsapp-600 bg-whatsapp-50 px-2.5 py-1 rounded-lg w-fit">
                        <Clock size={12} />
                        {o.customStartTime} - {o.customEndTime}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingOverride(o);
                          setFormData({
                            employeeId: o.employeeId,
                            branchBreakId: o.branchBreakId,
                            date: o.date,
                            customStartTime: o.customStartTime || '',
                            customEndTime: o.customEndTime || '',
                            isExcluded: o.isExcluded
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(o.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-whatsapp-600 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOverrides.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                    Henüz bir istisna tanımlanmamış.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingOverride ? 'İstisnayı Düzenle' : 'Yeni İstisna Ekle'}
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Personel Seçimi</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value, branchBreakId: '' })}
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
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Geçersiz Kılınacak Mola</label>
                    <select 
                      required
                      disabled={!formData.employeeId}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all disabled:opacity-50"
                      value={formData.branchBreakId}
                      onChange={(e) => setFormData({ ...formData, branchBreakId: e.target.value })}
                    >
                      <option value="">Mola Seçiniz...</option>
                      {availableBreaks.map(b => (
                        <option key={b.id} value={b.id}>{b.type} ({b.startTime}-{b.endTime})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-whatsapp-600 shadow-sm">
                    <Ban size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-700">Molayı İptal Et</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Bu personel bugün bu molayı yapmayacak.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.isExcluded}
                      onChange={(e) => setFormData({ ...formData, isExcluded: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-600"></div>
                  </label>
                </div>

                {!formData.isExcluded && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Özel Başlangıç</label>
                      <input 
                        type="time"
                        required={!formData.isExcluded}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                        value={formData.customStartTime}
                        onChange={(e) => setFormData({ ...formData, customStartTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Özel Bitiş</label>
                      <input 
                        type="time"
                        required={!formData.isExcluded}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                        value={formData.customEndTime}
                        onChange={(e) => setFormData({ ...formData, customEndTime: e.target.value })}
                      />
                    </div>
                  </div>
                )}
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
                  <span>{editingOverride ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
