import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  X, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  FileText,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  orderBy
} from 'firebase/firestore';
import { format, differenceInDays, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { LeaveRequest } from '@/types/leaves';

export default function EmployeeLeaves() {
  const [user] = useState(auth.currentUser);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    leaveTypeName: 'Yıllık İzin',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    note: ''
  });

  const LEAVE_TYPES = [
    'Yıllık İzin',
    'Ücretli İzin',
    'Ücretsiz İzin',
    'Raporlu',
    'Babalık İzni',
    'Doğum İzni',
    'Mazeret ve Diğer Ücretli İzinler'
  ];

  useEffect(() => {
    if (!user) return;

    // Fetch employee data first to get ID and other details
    const qEmp = query(collection(db, 'employees'), where('authUid', '==', user.uid));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setEmployeeData({ id: docSnap.id, ...data });
      }
    });

    return () => unsubEmp();
  }, [user]);

  useEffect(() => {
    if (!employeeData) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('employeeId', '==', employeeData.id),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    }, (error) => {
      console.error("Leave requests fetch error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [employeeData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeData) return;

    setSubmitting(true);
    try {
      const start = parseISO(formData.startDate);
      const end = parseISO(formData.endDate);
      const totalDays = differenceInDays(end, start) + 1;

      if (totalDays <= 0) {
        throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      }

      const newRequest: Omit<LeaveRequest, 'id'> = {
        employeeId: employeeData.id,
        employeeName: employeeData.name,
        employeeCode: employeeData.employeeCode || '',
        branchName: employeeData.branchName || '',
        leaveTypeName: formData.leaveTypeName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays: totalDays,
        note: formData.note,
        status: 'pending',
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'leave_requests'), newRequest);
      
      setIsModalOpen(false);
      setFormData({
        leaveTypeName: 'Yıllık İzin',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        note: ''
      });
      alert('İzin talebiniz başarıyla gönderildi.');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">ONAYLANDI</span>;
      case 'rejected':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">REDDEDİLDİ</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">İPTAL EDİLDİ</span>;
      default:
        return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">BEKLEMEDE</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-whatsapp-600/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <Calendar size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">İzin Yönetimi</h2>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">TALEPLERİNİZİ YÖNETİN</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-14 h-14 bg-white text-whatsapp-600 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={32} />
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">İZİN TALEPLERİNİZ</h3>
        
        <div className="space-y-3">
          {requests.length > 0 ? (
            requests.map((request) => (
              <div key={request.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{request.leaveTypeName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {request.totalDays} GÜN
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">BAŞLANGIÇ</span>
                    </div>
                    <p className="text-sm font-black text-slate-700">
                      {format(parseISO(request.startDate), 'd MMM yyyy', { locale: tr })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">BİTİŞ</span>
                    </div>
                    <p className="text-sm font-black text-slate-700">
                      {format(parseISO(request.endDate), 'd MMM yyyy', { locale: tr })}
                    </p>
                  </div>
                </div>

                {request.note && (
                  <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
                    <MessageSquare size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-500 italic leading-relaxed">{request.note}</p>
                  </div>
                )}

                {request.managerComment && (
                  <div className="flex items-start gap-2 p-3 bg-whatsapp-50 rounded-xl border border-whatsapp-100">
                    <AlertCircle size={14} className="text-whatsapp-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-whatsapp-600 uppercase tracking-widest">YÖNETİCİ NOTU</p>
                      <p className="text-xs text-whatsapp-800 leading-relaxed">{request.managerComment}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4 text-center border-dashed">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Calendar size={32} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-400">Henüz bir izin talebiniz bulunmuyor.</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50/50 p-5 rounded-[2rem] border border-blue-100 flex gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
          <AlertCircle size={24} className="text-blue-500" />
        </div>
        <p className="text-xs text-blue-800 font-medium leading-relaxed">
          İzin talepleriniz yönetici onayından sonra kesinleşir. Acil durumlar için lütfen yöneticinizle iletişime geçin.
        </p>
      </div>

      {/* New Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Yeni İzin Talebi</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">İZİN TÜRÜ</label>
                  <select 
                    value={formData.leaveTypeName}
                    onChange={(e) => setFormData({...formData, leaveTypeName: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-whatsapp-500 transition-colors appearance-none"
                  >
                    {LEAVE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">BAŞLANGIÇ</label>
                    <input 
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-whatsapp-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">BİTİŞ</label>
                    <input 
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-whatsapp-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">AÇIKLAMA (OPSİYONEL)</label>
                  <textarea 
                    value={formData.note}
                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                    placeholder="İzin nedeninizi kısaca açıklayın..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-whatsapp-500 transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-whatsapp-600 hover:bg-whatsapp-500 text-white rounded-2xl font-black shadow-lg shadow-whatsapp-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
                      <span>Talebi Gönder</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
