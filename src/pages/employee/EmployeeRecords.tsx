import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  QrCode, 
  ChevronRight,
  Loader2,
  Filter,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function EmployeeRecords() {
  const [user] = useState(auth.currentUser);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRecords = async () => {
      // First find the employee document
      const qEmp = query(collection(db, 'employees'), where('authUid', '==', user.uid));
      const snapEmp = await getDocs(qEmp);
      
      if (snapEmp.empty) {
        setLoading(false);
        return;
      }

      const employeeId = snapEmp.docs[0].id;

      const q = query(
        collection(db, 'attendance_records'),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });

      return unsub;
    };

    let unsub: any;
    fetchRecords().then(u => unsub = u);

    return () => unsub && unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin text-whatsapp-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Kayıtlarda ara..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:border-whatsapp-500 transition-colors shadow-sm"
          />
        </div>
        <button className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-600 shadow-sm active:scale-95 transition-transform">
          <Filter size={20} />
        </button>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">GEÇMİŞ KAYITLAR</h3>
        
        <div className="space-y-3">
          {records.length > 0 ? (
            records.map((record, i) => (
              <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {record.createdAt?.toDate ? format(record.createdAt.toDate(), 'd MMMM yyyy', { locale: tr }) : 'Bugün'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.branchName || 'Merkez Şube'}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                    record.status === 'completed' ? "bg-whatsapp-100 text-whatsapp-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {record.status === 'completed' ? 'TAMAMLANDI' : 'DEVAM EDİYOR'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">GİRİŞ</span>
                    </div>
                    <p className="text-lg font-black text-slate-700">
                      {record.checkIn?.toDate ? format(record.checkIn.toDate(), 'HH:mm') : '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">ÇIKIŞ</span>
                    </div>
                    <p className="text-lg font-black text-slate-700">
                      {record.checkOut?.toDate ? format(record.checkOut.toDate(), 'HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={14} />
                    <span className="text-xs font-medium italic">Konum doğrulandı</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <QrCode size={14} />
                    <span className="text-xs font-medium italic">QR ile işlem</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-12 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Clock size={32} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-400 text-center">Henüz kayıtlı mesai işleminiz bulunmuyor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
