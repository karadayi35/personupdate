import React from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  MoreVertical,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc,
  where
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: any;
  endDate: any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export default function Leaves() {
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  React.useEffect(() => {
    const leavesRef = collection(db, 'leaves');
    const q = query(leavesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaveData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];
      setRequests(leaveData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaves');
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const leaveRef = doc(db, 'leaves', id);
      await updateDoc(leaveRef, {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leaves/${id}`);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-500">
            <CheckCircle2 size={14} />
            Onaylandı
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-whatsapp-500/10 text-whatsapp-500">
            <XCircle size={14} />
            Reddedildi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500">
            <Clock size={14} />
            Beklemede
          </span>
        );
    }
  };

  const calculateDuration = (start: any, end: any) => {
    if (!start || !end) return '-';
    try {
      const startDate = start.toDate ? start.toDate() : new Date(start);
      const endDate = end.toDate ? end.toDate() : new Date(end);
      const days = differenceInDays(endDate, startDate) + 1;
      return `${days} Gün`;
    } catch (e) {
      return '-';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">İzin Yönetimi</h1>
          <p className="text-slate-400">Personel izin taleplerini inceleyin ve yönetin.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Talep', value: stats.total, icon: Calendar, color: 'blue' },
          { label: 'Bekleyen', value: stats.pending, icon: Clock, color: 'amber' },
          { label: 'Onaylanan', value: stats.approved, icon: CheckCircle2, color: 'green' },
          { label: 'Reddedilen', value: stats.rejected, icon: XCircle, color: 'red' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#111b21] p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl",
              stat.color === 'blue' ? "bg-whatsapp-500/10 text-whatsapp-500" :
              stat.color === 'amber' ? "bg-amber-500/10 text-amber-500" :
              stat.color === 'green' ? "bg-green-500/10 text-green-500" :
              "bg-whatsapp-500/10 text-whatsapp-500"
            )}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text"
            placeholder="Personel ismi ile ara..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="pending">Beklemede</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
              <Loader2 className="animate-spin text-whatsapp-500" size={32} />
              <p>İzin talepleri yükleniyor...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p>İzin talebi bulunamadı.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Personel</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">İzin Türü</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Tarih Aralığı</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Süre</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Neden</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Durum</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-whatsapp-500 font-bold border border-slate-700">
                          {req.employeeName ? req.employeeName[0] : '?'}
                        </div>
                        <span className="text-sm font-bold text-white">{req.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-200">{req.leaveType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>{req.startDate?.toDate ? format(req.startDate.toDate(), 'dd.MM.yyyy') : '-'}</span>
                        <ChevronRight size={14} className="text-slate-600" />
                        <span>{req.endDate?.toDate ? format(req.endDate.toDate(), 'dd.MM.yyyy') : '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {calculateDuration(req.startDate, req.endDate)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-400 truncate max-w-[200px]" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleStatusUpdate(req.id, 'approved')}
                            className="p-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg transition-all"
                            title="Onayla"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleStatusUpdate(req.id, 'rejected')}
                            className="p-2 bg-whatsapp-500/10 hover:bg-whatsapp-500 text-whatsapp-500 hover:text-white rounded-lg transition-all"
                            title="Reddet"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-whatsapp-500/5 border border-whatsapp-500/20 p-6 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-whatsapp-500/10 rounded-lg text-whatsapp-500">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="text-whatsapp-500 font-bold mb-1">Bilgilendirme</h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            İzin talepleri personeller tarafından mobil uygulama üzerinden oluşturulur. 
            Buradan bekleyen talepleri onaylayabilir veya reddedebilirsiniz. 
            Onaylanan izinler personelin takvimine otomatik olarak işlenir.
          </p>
        </div>
      </div>
    </div>
  );
}
