import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  CreditCard,
  ChevronRight,
  Loader2,
  Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';

export default function EmployeeProfile() {
  const [user] = useState(auth.currentUser);
  const [userData, setUserData] = useState<any>(null);
  const [branchName, setBranchName] = useState<string>('Belirtilmemiş');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'employees'), where('authUid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setUserData(data);
        
        // Fetch branch name if branchId exists
        if (data.branchId) {
          onSnapshot(doc(db, 'branches', data.branchId), (branchSnap) => {
            if (branchSnap.exists()) {
              setBranchName(branchSnap.data().name);
            }
          });
        } else if (data.branchName) {
          setBranchName(data.branchName);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="animate-spin text-whatsapp-600" />
      </div>
    );
  }

  const profileSections = [
    { icon: Mail, label: 'E-POSTA', value: userData?.email || 'Belirtilmemiş' },
    { icon: Phone, label: 'TELEFON', value: userData?.phone || 'Belirtilmemiş' },
    { icon: MapPin, label: 'ŞUBE', value: branchName },
    { icon: Shield, label: 'DEPARTMAN', value: userData?.department || 'Belirtilmemiş' },
    { icon: User, label: 'ÜNVAN', value: userData?.role || 'Personel' },
    { icon: CreditCard, label: 'SİCİL NO', value: userData?.employeeCode || 'Belirtilmemiş' },
  ];

  return (
    <div className="px-4 py-8 space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-[2.5rem] bg-whatsapp-50 flex items-center justify-center text-whatsapp-600 text-4xl font-black border-4 border-white shadow-xl">
            {userData?.name?.charAt(0) || '?'}
            <div className="absolute bottom-1 right-1 w-6 h-6 bg-whatsapp-500 border-4 border-white rounded-full" />
          </div>
          <button className="absolute -bottom-2 -right-2 p-3 bg-white rounded-2xl shadow-lg border border-slate-100 text-slate-600 active:scale-95 transition-transform">
            <Camera size={20} />
          </button>
        </div>
        
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{userData?.name || 'İsimsiz Kullanıcı'}</h2>
          <span className="text-xs font-bold text-whatsapp-600 uppercase tracking-widest">{userData?.role || 'PERSONEL'}</span>
        </div>
      </div>

      {/* Profile Info List */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">PROFİL BİLGİLERİ</h3>
        
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
          {profileSections.map((item, i) => (
            <div key={i} className="p-6 flex items-center justify-between group active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-active:bg-white transition-colors">
                  <item.icon size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                  <p className="font-bold text-slate-700">{item.value}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
