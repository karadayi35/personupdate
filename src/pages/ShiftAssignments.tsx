import React from 'react';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader2, 
  Save,
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle
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
import { Shift, EmployeeShiftAssignment } from '@/types/shifts';
import { ShiftService } from '@/services/shiftService';
import { Employee } from '@/types/employee';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ShiftAssignments() {
  const [assignments, setAssignments] = React.useState<EmployeeShiftAssignment[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [shifts, setShifts] = React.useState<Shift[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<Omit<EmployeeShiftAssignment, 'id'>>({
    employeeId: '',
    shiftId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    repeatType: 'daily',
    activeDays: [1, 2, 3, 4, 5], // Mon-Fri
    isActive: true
  });

  React.useEffect(() => {
    // Fetch assignments
    const assignmentsRef = collection(db, 'employee_shift_assignments');
    const q = query(assignmentsRef, orderBy('startDate', 'desc'));
    const unsubscribeAssignments = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmployeeShiftAssignment[];
      setAssignments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employee_shift_assignments');
    });

    // Fetch employees
    const employeesRef = collection(db, 'employees');
    const unsubscribeEmployees = onSnapshot(employeesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(data);
    });

    // Fetch shifts
    const shiftsRef = collection(db, 'shifts');
    const unsubscribeShifts = onSnapshot(shiftsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Shift[];
      setShifts(data);
      setLoading(false);
    });

    return () => {
      unsubscribeAssignments();
      unsubscribeEmployees();
      unsubscribeShifts();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employee_shift_assignments', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'employee_shift_assignments'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }

      // Trigger recalculation
      const endDate = formData.endDate || format(new Date(2100, 0, 1), 'yyyy-MM-dd');
      await ShiftService.recalculateForEmployeeInRange(formData.employeeId, formData.startDate, endDate);

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        employeeId: '',
        shiftId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        repeatType: 'daily',
        activeDays: [1, 2, 3, 4, 5],
        isActive: true
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'employee_shift_assignments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (assignment: EmployeeShiftAssignment) => {
    setEditingId(assignment.id);
    setFormData({
      employeeId: assignment.employeeId,
      shiftId: assignment.shiftId,
      startDate: assignment.startDate,
      endDate: assignment.endDate || '',
      repeatType: assignment.repeatType,
      activeDays: assignment.activeDays,
      isActive: assignment.isActive
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu vardiya atamasını silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'employee_shift_assignments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employee_shift_assignments/${id}`);
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day]
    }));
  };

  const days = [
    { id: 1, label: 'Pzt' },
    { id: 2, label: 'Sal' },
    { id: 3, label: 'Çar' },
    { id: 4, label: 'Per' },
    { id: 5, label: 'Cum' },
    { id: 6, label: 'Cmt' },
    { id: 0, label: 'Paz' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Personel veya vardiya ara..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
          />
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({
              employeeId: '',
              shiftId: '',
              startDate: format(new Date(), 'yyyy-MM-dd'),
              endDate: '',
              repeatType: 'daily',
              activeDays: [1, 2, 3, 4, 5],
              isActive: true
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={20} />
          <span>Yeni Atama</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">PERSONEL</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">VARDİYA</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">TARİH ARALIĞI</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">GÜNLER</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">DURUM</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Henüz vardiya ataması yapılmamış.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => {
                  const employee = employees.find(e => e.id === assignment.employeeId);
                  const shift = shifts.find(s => s.id === assignment.shiftId);
                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors group">
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
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            shift?.isNightShift ? "bg-indigo-500" : "bg-amber-500"
                          )} />
                          <span className="font-medium text-slate-700">{shift?.name || 'Bilinmiyor'}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{shift?.startTime} - {shift?.endTime}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{assignment.startDate}</span>
                          <span className="text-slate-300">→</span>
                          <span>{assignment.endDate || 'Süresiz'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {days.map(day => (
                            <div 
                              key={day.id}
                              className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-bold",
                                assignment.activeDays.includes(day.id)
                                  ? "bg-whatsapp-50 text-whatsapp-600 border border-whatsapp-100"
                                  : "bg-slate-50 text-slate-300 border border-slate-100"
                              )}
                            >
                              {day.label}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          assignment.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                        )}>
                          {assignment.isActive ? (
                            <><CheckCircle2 size={12} /> Aktif</>
                          ) : (
                            <><XCircle size={12} /> Pasif</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(assignment)}
                            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-whatsapp-600 transition-all shadow-sm"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(assignment.id)}
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

      {/* Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Atamayı Düzenle' : 'Yeni Vardiya Ataması'}</h2>
                <p className="text-sm text-slate-500 mt-1">Personel için çalışma düzenini belirleyin.</p>
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
                  <label className="text-sm font-bold text-slate-700 ml-1">Vardiya Şablonu</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    value={formData.shiftId}
                    onChange={(e) => {
                      const shiftId = e.target.value;
                      const shift = shifts.find(s => s.id === shiftId);
                      setFormData({ 
                        ...formData, 
                        shiftId,
                        activeDays: shift?.activeDays || formData.activeDays
                      });
                    }}
                  >
                    <option value="">Seçiniz...</option>
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}-{shift.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Başlangıç Tarihi</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Bitiş Tarihi (Opsiyonel)</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 ml-1">Çalışma Günleri</label>
                <div className="flex flex-wrap gap-2">
                  {days.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={cn(
                        "flex-1 min-w-[60px] py-3 rounded-xl text-xs font-bold transition-all border",
                        formData.activeDays.includes(day.id)
                          ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600 shadow-sm"
                          : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
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
                  <span>{editingId ? 'Güncelle' : 'Atamayı Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
