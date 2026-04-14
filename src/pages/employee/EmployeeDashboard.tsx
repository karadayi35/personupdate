import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  FileText, 
  QrCode, 
  Coffee, 
  MapPin, 
  ChevronRight,
  Loader2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { format, startOfDay, isToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function EmployeeDashboard() {
  const [user] = useState(auth.currentUser);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [branchData, setBranchData] = useState<any>(null);
  const [shiftInfo, setShiftInfo] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'break'>('idle');
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [qrAction, setQrAction] = useState<'check-in' | 'check-out' | null>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch employee data
    const q = query(collection(db, 'employees'), where('authUid', '==', user.uid));
    const unsubEmp = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        setEmployeeData({ id: docSnap.id, ...data });
        
        if (data.branchId) {
          onSnapshot(doc(db, 'branches', data.branchId), (branchSnap) => {
            if (branchSnap.exists()) {
              setBranchData({ id: branchSnap.id, ...branchSnap.data() });
            }
          });
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubEmp();
      const html5QrCode = (window as any).html5QrCode;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {});
        }
      }
    };
  }, [user]);

  // Fetch status and records when employeeData is available
  useEffect(() => {
    if (!employeeData) return;

    // Fetch current status
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const qStatus = query(
      collection(db, 'attendance_records'),
      where('employeeId', '==', employeeData.id),
      where('date', '==', todayStr),
      where('status', '==', 'working')
    );

    const unsubStatus = onSnapshot(qStatus, (snapshot) => {
      if (!snapshot.empty) {
        setStatus('working');
        setCurrentRecordId(snapshot.docs[0].id);
      } else {
        setStatus('idle');
        setCurrentRecordId(null);
      }
      setLoading(false);
    });

    // Fetch recent records
    const recentQ = query(
      collection(db, 'attendance_records'),
      where('employeeId', '==', employeeData.id),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubRecent = onSnapshot(recentQ, (snapshot) => {
      setRecentRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch shift info
    const fetchShift = async () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const todayStr = format(today, 'yyyy-MM-dd');

      const q = query(
        collection(db, 'employee_shift_assignments'),
        where('employeeId', '==', employeeData.id),
        where('isActive', '==', true)
      );

      const snap = await getDocs(q);
      const assignment = snap.docs.find(d => {
        const data = d.data();
        return data.activeDays.includes(dayOfWeek) && 
               data.startDate <= todayStr && 
               (!data.endDate || data.endDate >= todayStr);
      });

      if (assignment) {
        const shiftSnap = await getDocs(query(collection(db, 'shifts'), where('__name__', '==', assignment.data().shiftId)));
        if (!shiftSnap.empty) {
          setShiftInfo(shiftSnap.docs[0].data());
        }
      }
    };

    fetchShift();

    return () => {
      unsubStatus();
      unsubRecent();
    };
  }, [employeeData]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleQRScan = (decodedText: string) => {
    // Verify if the scanned QR code matches the branch ID
    console.log('QR Scanned:', decodedText);
    
    // The QR code should contain the branch ID
    if (branchData && decodedText !== branchData.id) {
      alert('Hata: Yanlış şube QR kodu! Lütfen kendi şubenizin kodunu okutun.');
      closeScanner();
      return;
    }
    
    if (qrAction === 'check-in') {
      processCheckIn();
    } else if (qrAction === 'check-out') {
      processCheckOut();
    }
    
    closeScanner();
  };

  const processCheckIn = async () => {
    if (!branchData) return;
    setActionLoading(true);
    try {
      // Get real location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const distance = calculateDistance(latitude, longitude, branchData.lat, branchData.lng);
      
      // Get global settings for radius fallback if needed
      let allowedRadius = branchData.radius || 100;
      
      if (distance > allowedRadius) {
        alert(`Hata: Şube kapsama alanı dışındasınız. (${Math.round(distance)}m)\nİzin verilen: ${allowedRadius}m`);
        setActionLoading(false);
        return;
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await addDoc(collection(db, 'attendance_records'), {
        employeeId: employeeData.id,
        employeeName: employeeData.name,
        branchId: branchData.id,
        branchName: branchData.name,
        date: todayStr,
        checkIn: serverTimestamp(),
        checkOut: null,
        method: 'QR',
        location: { 
          lat: latitude, 
          lng: longitude, 
          isWithinRadius: true,
          distance: Math.round(distance)
        },
        status: 'working',
        createdAt: serverTimestamp()
      });
      
      alert('Giriş başarılı!');
    } catch (error: any) {
      console.error('Check-in error:', error);
      if (error.code === 1) {
        alert('Hata: Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum izni verin.');
      } else {
        alert('Hata: ' + error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const processCheckOut = async () => {
    if (!currentRecordId) return;
    setActionLoading(true);
    try {
      const docRef = doc(db, 'attendance_records', currentRecordId);
      await updateDoc(docRef, {
        checkOut: serverTimestamp(),
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      alert('Çıkış başarılı!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const startScanner = (action: 'check-in' | 'check-out') => {
    setQrAction(action);
    setIsQRScannerOpen(true);
    
    // Initialize scanner in next tick
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("qr-reader");
      const qrCodeSuccessCallback = (decodedText: string) => {
        handleQRScan(decodedText);
      };
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // Start scanning with back camera
      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback,
        (errorMessage) => {
          // parse error, ignore
        }
      ).catch((err) => {
        console.error("Kamera başlatılamadı:", err);
        alert("Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.");
        setIsQRScannerOpen(false);
      });
      
      // Store scanner to clear it later
      (window as any).html5QrCode = html5QrCode;
    }, 100);
  };

  const closeScanner = () => {
    const html5QrCode = (window as any).html5QrCode;
    if (html5QrCode) {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch((err: any) => {
          console.error('Scanner stop error:', err);
        });
      }
    }
    setIsQRScannerOpen(false);
    setQrAction(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-whatsapp-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Welcome Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-whatsapp-600/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-2 text-white/80">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">CANLI TAKİP SİSTEMİ</span>
          </div>
          
          <div>
            <p className="text-sm font-medium text-white/80">Hoş geldin,</p>
            <h2 className="text-3xl font-bold tracking-tight">{employeeData?.name || 'Necati candan'}</h2>
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">BUGÜNKÜ VARDİYA</p>
              <p className="text-2xl font-black">
                {shiftInfo ? `${shiftInfo.startTime} - ${shiftInfo.endTime}` : '08:45 - 18:15'}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-whatsapp-300 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">DURUM: AKTİF</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">HIZLI ERİŞİM</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Calendar, label: 'İzin Al', color: 'text-blue-500', bg: 'bg-blue-50', path: '/mobile/leaves' },
            { icon: Clock, label: 'Vardiya', color: 'text-purple-500', bg: 'bg-purple-50', path: '/mobile/schedule' },
            { icon: FileText, label: 'Kayıtlar', color: 'text-orange-500', bg: 'bg-orange-50', path: '/mobile/records' },
          ].map((item, i) => (
            <Link 
              key={i} 
              to={item.path}
              className="flex flex-col items-center gap-3 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.bg, item.color)}>
                <item.icon size={24} />
              </div>
              <span className="text-xs font-bold text-slate-600">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* QR Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => startScanner('check-in')}
          disabled={status === 'working' || actionLoading}
          className={cn(
            "flex flex-col items-center gap-4 p-6 rounded-[2rem] border transition-all active:scale-95",
            status === 'working' 
              ? "bg-slate-50 border-slate-100 opacity-50 grayscale" 
              : "bg-white border-whatsapp-100 shadow-sm hover:border-whatsapp-200"
          )}
        >
          <div className="w-16 h-16 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
            <QrCode size={32} />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-800">Giriş Yap</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">QR OKUT</p>
          </div>
        </button>

        <button 
          onClick={() => startScanner('check-out')}
          disabled={status === 'idle' || actionLoading}
          className={cn(
            "flex flex-col items-center gap-4 p-6 rounded-[2rem] border transition-all active:scale-95",
            status === 'idle' 
              ? "bg-slate-50 border-slate-100 opacity-50 grayscale" 
              : "bg-white border-red-100 shadow-sm hover:border-red-200"
          )}
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <QrCode size={32} />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-800">Çıkış Yap</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">QR OKUT</p>
          </div>
        </button>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button className="flex items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform">
          <Coffee size={20} className="text-orange-500" />
          <span className="text-sm font-bold text-slate-700">Mola Başlat</span>
        </button>
        <button className="flex items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform">
          <MapPin size={20} className="text-blue-500" />
          <span className="text-sm font-bold text-slate-700">Konum Bildir</span>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-whatsapp-50/50 p-5 rounded-[2rem] border border-whatsapp-100 flex gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck size={24} className="text-whatsapp-600" />
        </div>
        <p className="text-xs text-whatsapp-800 font-medium leading-relaxed">
          Giriş ve çıkış işlemleri sırasında konumunuz doğrulanmaktadır. Lütfen şube sınırları içerisinde olduğunuzdan emin olun.
        </p>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">SON İŞLEMLER</h3>
          <button className="text-[10px] font-bold text-whatsapp-600 uppercase tracking-widest">TÜMÜNÜ GÖR</button>
        </div>
        
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {recentRecords.length > 0 ? (
            recentRecords.map((record, i) => (
              <div key={i} className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    record.checkOut ? "bg-red-50 text-red-600" : "bg-whatsapp-50 text-whatsapp-600"
                  )}>
                    {record.checkOut ? <Clock size={20} /> : <QrCode size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {record.checkOut ? 'Mesai Çıkışı' : 'Mesai Girişi'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400">
                      {record.createdAt?.toDate ? format(record.createdAt.toDate(), 'd MMMM, HH:mm', { locale: tr }) : 'Az önce'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            ))
          ) : (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <AlertCircle size={32} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-400">Henüz işlem bulunamadı</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {isQRScannerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-sm space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">QR Kod Okutun</h2>
                <p className="text-white/60 text-sm">
                  {qrAction === 'check-in' ? 'Giriş yapmak için şube kodunu okutun' : 'Çıkış yapmak için şube kodunu okutun'}
                </p>
              </div>

              <div className="relative aspect-square bg-white/5 rounded-[3rem] overflow-hidden border-2 border-white/20">
                <div id="qr-reader" className="w-full h-full" />
                {/* Scanning Frame Overlay */}
                <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-whatsapp-500 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-whatsapp-500 -mt-1 -ml-1 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-whatsapp-500 -mt-1 -mr-1 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-whatsapp-500 -mb-1 -ml-1 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-whatsapp-500 -mb-1 -mr-1 rounded-br-lg" />
                  </div>
                </div>
              </div>

              <button 
                onClick={closeScanner}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
