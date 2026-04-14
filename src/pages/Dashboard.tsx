import React from 'react';
import { 
  ArrowRightToLine, 
  UserCheck, 
  Ban, 
  Coffee, 
  Clock, 
  Undo2,
  Calendar,
  RefreshCcw,
  ChevronRight,
  Loader2,
  MapPin,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, where, Timestamp, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isToday } from 'date-fns';

interface PersonnelItem {
  name: string;
  time?: string;
  shift?: string;
  status?: string;
  avatar?: string;
}

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  items: PersonnelItem[];
  showAllLink?: string;
  loading?: boolean;
}

const DashboardCard = ({ title, subtitle, icon: Icon, iconColor, items, showAllLink, loading }: DashboardCardProps) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[300px]">
    <div className="p-5 flex items-start justify-between">
      <div className="flex gap-4">
        <div className={cn("p-2.5 rounded-xl", iconColor)}>
          <Icon size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button className="text-slate-300 hover:text-slate-500 transition-colors">
        <RefreshCcw size={16} />
      </button>
    </div>
    
    <div className="flex-1 px-5 pb-2 space-y-4">
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="animate-spin text-slate-300" size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-xs italic">
          Kayıt bulunamadı
        </div>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                <img 
                  src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.name}`} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {item.status && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-whatsapp-100 text-whatsapp-600 uppercase">
                  {item.status}
                </span>
              )}
              {item.time && (
                <span className="text-xs font-bold text-slate-900">{item.time}</span>
              )}
              {item.shift && (
                <span className="text-xs text-slate-400">({item.shift})</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>

    {showAllLink && (
      <div className="p-4 mt-auto border-t border-slate-50">
        <button className="w-full flex items-center justify-end gap-1 text-xs font-bold text-whatsapp-600 hover:text-whatsapp-700 transition-colors">
          <span>Tümünü gör</span>
          <ChevronRight size={14} />
        </button>
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const [user, setUser] = React.useState<any>(null);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [attendance, setAttendance] = React.useState<any[]>([]);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [overrides, setOverrides] = React.useState<any[]>([]);
  const [shifts, setShifts] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Employee specific state
  const [employeeData, setEmployeeData] = React.useState<any>(null);
  const [branchData, setBranchData] = React.useState<any>(null);
  const [shiftInfo, setShiftInfo] = React.useState<any>(null);
  const [isDayOff, setIsDayOff] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'working'>('idle');
  const [currentRecordId, setCurrentRecordId] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const isAdmin = user?.email === 'aalikirmizigul89@gmail.com';

  React.useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance_records'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAssignments = onSnapshot(collection(db, 'employee_shift_assignments'), (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubOverrides = onSnapshot(collection(db, 'shift_overrides'), (snapshot) => {
      setOverrides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);

    return () => {
      unsubAuth();
      unsubEmployees();
      unsubAttendance();
      unsubAssignments();
      unsubOverrides();
      unsubShifts();
      unsubBranches();
    };
  }, []);

  // Employee logic: Fetch personal data
  React.useEffect(() => {
    if (!user) return;

    const emp = employees.find(e => e.authUid === user.uid);
    if (emp) {
      setEmployeeData(emp);
      if (emp.branchId) {
        const branch = branches.find(b => b.id === emp.branchId);
        setBranchData(branch);
      }

      // Check current status
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const activeRecord = attendance.find(r => 
        r.employeeId === user.uid && 
        r.date === todayStr && 
        r.status === 'working'
      );
      
      if (activeRecord) {
        setStatus('working');
        setCurrentRecordId(activeRecord.id);
      } else {
        setStatus('idle');
        setCurrentRecordId(null);
      }

      // Fetch shift info
      const dayOfWeek = new Date().getDay();
      const override = overrides.find(o => o.employeeId === emp.id && o.date === todayStr);
      
      if (override) {
        if (override.overrideType === 'day_off') {
          setIsDayOff(true);
          setShiftInfo({ name: 'Hafta Tatili', startTime: '-', endTime: '-' });
        } else {
          setShiftInfo({
            name: 'Özel Vardiya',
            startTime: override.customStartTime,
            endTime: override.customEndTime
          });
        }
      } else {
        const assignment = assignments.find(a => 
          a.employeeId === emp.id && 
          a.isActive && 
          a.startDate <= todayStr &&
          (!a.endDate || a.endDate >= todayStr) &&
          a.activeDays.includes(dayOfWeek)
        );

        if (assignment) {
          const shift = shifts.find(s => s.id === assignment.shiftId);
          if (shift) {
            setShiftInfo({
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime
            });
            setIsDayOff(false);
          } else {
            setIsDayOff(true);
            setShiftInfo({ name: 'Vardiya Atanmamış', startTime: '-', endTime: '-' });
          }
        } else {
          setIsDayOff(true);
          setShiftInfo({ name: 'Planlı Vardiya Yok', startTime: '-', endTime: '-' });
        }
      }
    } else {
      setEmployeeData(null);
      setBranchData(null);
      setShiftInfo(null);
    }
  }, [user, employees, branches, attendance, overrides, assignments, shifts]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCheckIn = async () => {
    if (!branchData) {
      alert('Hata: Bağlı olduğunuz şube bilgisi bulunamadı.');
      return;
    }

    setActionLoading(true);
    try {
      // Get location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      const distance = calculateDistance(latitude, longitude, branchData.lat, branchData.lng);

      if (distance > branchData.radius) {
        alert(`Hata: Şube kapsama alanı dışındasınız. (${Math.round(distance)}m)\nİzin verilen: ${branchData.radius}m`);
        setActionLoading(false);
        return;
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await addDoc(collection(db, 'attendance_records'), {
        employeeId: user.uid,
        employeeName: employeeData.name,
        branchId: branchData.id,
        branchName: branchData.name,
        date: todayStr,
        checkIn: serverTimestamp(),
        checkOut: null,
        method: 'Web',
        location: { lat: latitude, lng: longitude, isWithinRadius: true },
        status: 'working',
        createdAt: serverTimestamp()
      });

      alert('Giriş yapıldı.');
    } catch (error: any) {
      alert('Konum alınamadı veya bir hata oluştu: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentRecordId) return;
    setActionLoading(true);
    try {
      const docRef = doc(db, 'attendance_records', currentRecordId);
      await updateDoc(docRef, {
        checkOut: serverTimestamp(),
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      alert('Çıkış yapıldı.');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getShiftForEmployee = (employeeId: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const dayOfWeek = new Date().getDay();

    // 1. Check overrides
    const override = overrides.find(o => o.employeeId === employeeId && o.date === todayStr);
    if (override) {
      if (override.overrideType === 'day_off') return 'İzinli';
      return `${override.customStartTime} - ${override.customEndTime}`;
    }

    // 2. Check assignments
    const assignment = assignments.find(a => 
      a.isActive && 
      a.employeeId === employeeId && 
      a.activeDays.includes(dayOfWeek) &&
      a.startDate <= todayStr &&
      (!a.endDate || a.endDate >= todayStr)
    );

    if (assignment) {
      const shift = shifts.find(s => s.id === assignment.shiftId);
      if (shift) return `${shift.startTime} - ${shift.endTime}`;
    }

    return 'Vardiya Yok';
  };

  const todayAttendance = attendance.filter(record => {
    const checkInDate = record.checkIn?.toDate ? record.checkIn.toDate() : new Date(record.checkIn);
    return isToday(checkInDate);
  });

  const cameToWork = todayAttendance.map(record => ({
    name: record.employeeName,
    time: record.checkIn?.toDate ? format(record.checkIn.toDate(), 'HH:mm') : format(new Date(record.checkIn), 'HH:mm'),
    shift: getShiftForEmployee(record.employeeId)
  }));

  const currentlyWorking = todayAttendance.filter(r => !r.checkOut).map(record => ({
    name: record.employeeName,
    time: record.checkIn?.toDate ? format(record.checkIn.toDate(), 'HH:mm') : format(new Date(record.checkIn), 'HH:mm'),
    shift: getShiftForEmployee(record.employeeId)
  }));

  const notCame = employees.filter(emp => 
    !todayAttendance.some(record => record.employeeId === emp.id)
  ).map(emp => ({
    name: emp.name,
    status: 'Giriş Yapmadı',
    shift: getShiftForEmployee(emp.id)
  }));

  const latecomers = todayAttendance.filter(r => r.status === 'late').map(record => ({
    name: record.employeeName,
    time: record.checkIn?.toDate ? format(record.checkIn.toDate(), 'HH:mm') : format(new Date(record.checkIn), 'HH:mm'),
    shift: getShiftForEmployee(record.employeeId)
  }));

  const earlyExits = todayAttendance.filter(r => r.status === 'early-exit').map(record => ({
    name: record.employeeName,
    time: record.checkOut?.toDate ? format(record.checkOut.toDate(), 'HH:mm') : (record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : ''),
    shift: getShiftForEmployee(record.employeeId)
  }));

  // Determine what to show
  // If user is an admin, show the admin dashboard. 
  // If user is only an employee, show the check-in panel.
  const showAdminView = isAdmin;
  const showEmployeeView = employeeData !== null && !isAdmin;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto px-4 sm:px-8 pb-10">
      {/* Employee Check-in Section */}
      {showEmployeeView && (
        <div className={cn(
          "max-w-md mx-auto w-full space-y-6 mb-10",
          isAdmin && "border-b border-slate-200 pb-10"
        )}>
          {isAdmin && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-amber-700 text-[10px] font-bold uppercase text-center mb-4">
              Yönetici Modu: Kişisel Giriş/Çıkış Paneli
            </div>
          )}
          {/* Welcome & Branch Info */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-20 h-20 bg-whatsapp-50 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-sm">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                alt="Avatar"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Merhaba, {employeeData?.name || user?.email?.split('@')[0]}</h1>
              <div className="flex items-center justify-center gap-1.5 text-slate-500 mt-1">
                <MapPin size={16} className="text-whatsapp-600" />
                <span className="text-sm font-medium">{branchData?.name || 'Şube Belirtilmemiş'}</span>
              </div>
            </div>
          </div>

          {/* Shift Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bugünkü Vardiya</span>
              {branchData && (
                <span className="bg-whatsapp-100 text-whatsapp-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  {branchData.name}
                </span>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm text-slate-500 font-medium">{shiftInfo?.name || 'Yükleniyor...'}</p>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-whatsapp-600" />
                    <span className="text-xl font-bold text-slate-800">
                      {shiftInfo?.startTime || '-'} - {shiftInfo?.endTime || '-'}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isDayOff ? "bg-amber-50 text-amber-600" : "bg-whatsapp-50 text-whatsapp-600"
                )}>
                  {isDayOff ? <Calendar size={24} /> : <Clock size={24} />}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {status === 'idle' ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={isDayOff || actionLoading}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2",
                      isDayOff 
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                        : "bg-whatsapp-600 hover:bg-whatsapp-700 text-white shadow-whatsapp-600/20 active:scale-95"
                    )}
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRightToLine size={24} />}
                    <span>{isDayOff ? 'Hafta Tatili' : 'Giriş Yap'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full bg-whatsapp-600 hover:bg-whatsapp-500 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-whatsapp-600/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <LogOut size={24} />}
                    <span>Çıkış Yap</span>
                  </button>
                )}
                
                {isDayOff && (
                  <p className="text-center text-xs text-amber-600 font-medium italic">
                    Bugün planlı bir vardiyanız bulunmamaktadır.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-whatsapp-50 p-4 rounded-2xl border border-whatsapp-100 flex gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck size={20} className="text-whatsapp-600" />
            </div>
            <p className="text-xs text-whatsapp-800 leading-relaxed">
              Giriş ve çıkış işlemleri sırasında konumunuz doğrulanmaktadır. Lütfen şube sınırları içerisinde olduğunuzdan emin olun.
            </p>
          </div>
        </div>
      )}

      {/* Admin Statistics Section */}
      {showAdminView && (
        <div className="space-y-6">
          {isAdmin && employeeData && (
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Yönetici İstatistikleri</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard 
          title={`Bugün ${cameToWork.length} kişi işe geldi`}
          subtitle="Giriş yapan kullanıcılar listelenmektedir"
          icon={ArrowRightToLine}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/attendance"
          items={cameToWork.slice(0, 4)}
          loading={loading}
        />

        <DashboardCard 
          title={`Şu anda ${currentlyWorking.length} kişi çalışıyor`}
          subtitle="Giriş yapan, henüz çıkış yapmayan kullanıcılar"
          icon={UserCheck}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/attendance"
          items={currentlyWorking.slice(0, 4)}
          loading={loading}
        />

        <DashboardCard 
          title={`Bugün ${notCame.length} kişi gelmedi`}
          subtitle="Giriş yapmayan kullanıcılar listelenmektedir"
          icon={Ban}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/attendance"
          items={notCame.slice(0, 4)}
          loading={loading}
        />

        <DashboardCard 
          title="Şu anda 0 kişi molada"
          subtitle="Molaya başlayan, henüz bitirmeyen kullanıcılar"
          icon={Coffee}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/breaks"
          items={[]}
          loading={loading}
        />

        <DashboardCard 
          title={`Bugün ${latecomers.length} kişi geç kaldı`}
          subtitle="5 dk. tolerans ile hesaplanmaktadır"
          icon={Clock}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/attendance"
          items={latecomers.slice(0, 4)}
          loading={loading}
        />

        <DashboardCard 
          title={`Bugün ${earlyExits.length} kişi erken çıktı`}
          subtitle="5 dk. tolerans ile hesaplanmaktadır"
          icon={Undo2}
          iconColor="bg-whatsapp-50 text-whatsapp-600"
          showAllLink="/attendance"
          items={earlyExits.slice(0, 4)}
          loading={loading}
        />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full lg:col-span-1">
          <div className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-whatsapp-50 text-whatsapp-600">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Resmi tatiller</h3>
              <p className="text-xs text-slate-400 mt-0.5">Yaklaşan resmi tatil günleri</p>
            </div>
          </div>
          
          <div className="px-5 pb-6 space-y-4">
            {(() => {
              const allHolidays = [
                // 2026
                { name: 'Ulusal Egemenlik ve Çocuk Bayramı', date: new Date(2026, 3, 23), displayDate: '23 Nis 2026, Prş' },
                { name: 'Emek ve Dayanışma Günü', date: new Date(2026, 4, 1), displayDate: '01 May 2026, Cum' },
                { name: 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı', date: new Date(2026, 4, 19), displayDate: '19 May 2026, Sal' },
                { name: 'Kurban Bayramı', date: new Date(2026, 4, 27), displayDate: '27 - 30 May 2026' },
                { name: 'Demokrasi ve Milli Birlik Günü', date: new Date(2026, 6, 15), displayDate: '15 Tem 2026, Çrş' },
                { name: 'Zafer Bayramı', date: new Date(2026, 7, 30), displayDate: '30 Ağu 2026, Paz' },
                { name: 'Cumhuriyet Bayramı', date: new Date(2026, 9, 29), displayDate: '29 Eki 2026, Prş' },
                // 2027
                { name: 'Yılbaşı', date: new Date(2027, 0, 1), displayDate: '01 Oca 2027, Cum' },
                { name: 'Ramazan Bayramı', date: new Date(2027, 2, 9), displayDate: '09 - 11 Mar 2027' },
                { name: 'Ulusal Egemenlik ve Çocuk Bayramı', date: new Date(2027, 3, 23), displayDate: '23 Nis 2027, Cum' },
                { name: 'Emek ve Dayanışma Günü', date: new Date(2027, 4, 1), displayDate: '01 May 2027, Cmt' },
              ];

              const upcomingHolidays = allHolidays
                .filter(h => h.date >= startOfDay(new Date()))
                .slice(0, 4);

              return upcomingHolidays.map((holiday, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-sm font-medium text-slate-600">{holiday.name}</span>
                  <span className="text-xs font-bold text-slate-400">{holiday.displayDate}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  )}
</div>
);
}
