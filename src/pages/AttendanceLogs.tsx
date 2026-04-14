import React from 'react';
import { 
  Calendar, 
  Download, 
  Search, 
  MapPin, 
  Smartphone, 
  QrCode,
  ArrowRight,
  RefreshCcw,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { ShiftService } from '@/services/shiftService';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branchId: string;
  branchName?: string;
  checkIn: any;
  checkOut: any;
  workDuration: number;
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  method: 'QR' | 'Manual' | 'NFC' | 'Web';
  status: 'on-time' | 'late' | 'early-exit' | 'working' | 'normal' | 'overtime' | 'absent' | 'leave' | 'completed';
  location: {
    address: string;
    isWithinRadius?: boolean;
    distance?: number;
  };
}

interface Branch {
  id: string;
  name: string;
}

export default function AttendanceLogs() {
  const [records, setRecords] = React.useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [recalculating, setRecalculating] = React.useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedDate, setSelectedDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [selectedStatus, setSelectedStatus] = React.useState('all');

  const isAdmin = auth.currentUser?.email === 'aalikirmizigul89@gmail.com';

  const handleRecalculate = async () => {
    if (!isAdmin) return;
    if (!selectedDate) return;
    if (!window.confirm(`${selectedDate} tarihindeki tüm kayıtları yeniden hesaplamak istediğinize emin misiniz?`)) return;
    
    setRecalculating(true);
    try {
      await ShiftService.recalculateAllInRange(selectedDate, selectedDate);
    } catch (error) {
      console.error('Recalculation error:', error);
    } finally {
      setRecalculating(false);
    }
  };

  React.useEffect(() => {
    // Fetch Branches
    const branchesRef = collection(db, 'branches');
    const unsubscribeBranches = onSnapshot(branchesRef, (snapshot) => {
      const branchData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Branch[];
      setBranches(branchData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });

    // Fetch Attendance Records
    const attendanceRef = collection(db, 'attendance_records');
    let q = query(attendanceRef, orderBy('checkIn', 'desc'));

    if (!isAdmin && auth.currentUser) {
      q = query(
        attendanceRef, 
        where('employeeId', '==', auth.currentUser.uid),
        orderBy('checkIn', 'desc')
      );
    }

    const unsubscribeAttendance = onSnapshot(q, (snapshot) => {
      const attendanceData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Fallback for branch name if not stored in record
          branchName: data.branchName || branches.find(b => b.id === data.branchId)?.name || 'Bilinmiyor'
        };
      }) as AttendanceRecord[];
      setRecords(attendanceData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance_records');
    });

    return () => {
      unsubscribeBranches();
      unsubscribeAttendance();
    };
  }, [isAdmin, auth.currentUser, branches.length]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date filter
    let matchesDate = true;
    if (selectedDate) {
      const recordDate = record.checkIn?.toDate ? format(record.checkIn.toDate(), 'yyyy-MM-dd') : '';
      matchesDate = recordDate === selectedDate;
    }

    const matchesBranch = selectedBranch === 'all' || record.branchId === selectedBranch;
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;

    return matchesSearch && matchesDate && matchesBranch && matchesStatus;
  });

  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'Personel': record.employeeName,
      'Şube': record.branchName,
      'Giriş': record.checkIn?.toDate ? format(record.checkIn.toDate(), 'HH:mm') : '-',
      'Çıkış': record.checkOut?.toDate ? format(record.checkOut.toDate(), 'HH:mm') : '-',
      'Süre (dk)': record.workDuration || '-',
      'Yöntem': record.method,
      'Konum': record.location?.address || '-',
      'Konum Durumu': record.location?.isWithinRadius ? 'Alan İçinde' : 'Alan Dışında',
      'Durum': record.status === 'on-time' ? 'Zamanında' : 
               record.status === 'late' ? 'Geç Kaldı' : 
               record.status === 'working' ? 'İçeride' : record.status,
      'Tarih': record.checkIn?.toDate ? format(record.checkIn.toDate(), 'dd.MM.yyyy') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Giriş-Çıkış Kayıtları");
    
    const fileName = `PersoTrack_Rapor_${format(new Date(), 'dd_MM_yyyy')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      return format(timestamp.toDate(), 'HH:mm');
    } catch (e) {
      return '-';
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}s ${m}dk`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Giriş-Çıkış İşlemleri</h1>
          <p className="text-slate-500">Günlük katılım ve çalışma sürelerini takip edin.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRecalculate}
            disabled={recalculating || !selectedDate}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all duration-200 border border-slate-200 shadow-sm active:scale-95 disabled:opacity-50"
          >
            {recalculating ? <Loader2 size={20} className="animate-spin text-whatsapp-600" /> : <RefreshCcw size={20} className="text-whatsapp-600" />}
            <span>Yeniden Hesapla</span>
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all duration-200 border border-slate-200 shadow-sm active:scale-95"
          >
            <Download size={20} className="text-whatsapp-600" />
            <span>Excel Dışa Aktar</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Personel ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
          />
        </div>
        <select 
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
        >
          <option value="all">Tüm Şubeler</option>
          {branches.map(branch => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
        >
          <option value="all">Tüm Durumlar</option>
          <option value="on-time">Zamanında</option>
          <option value="late">Geç Kaldı</option>
          <option value="working">İçeride</option>
          <option value="early-exit">Erken Çıkış</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Şube</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Giriş / Çıkış</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Süre / Gecikme</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Yöntem</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Konum Durumu</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Loader2 className="animate-spin text-whatsapp-600" size={24} />
                      <span className="font-medium">Kayıtlar yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                          {log.employeeName ? log.employeeName[0] : '?'}
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-whatsapp-600 transition-colors">{log.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{log.branchName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-600 font-bold">{formatTime(log.checkIn)}</span>
                        <ArrowRight size={14} className="text-slate-300" />
                        <span className={cn(!log.checkOut ? "text-slate-400 italic" : "text-whatsapp-600 font-bold")}>
                          {log.checkOut ? formatTime(log.checkOut) : 'Devam ediyor'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-600 font-bold">{formatDuration(log.workedMinutes || log.workDuration)}</span>
                        {(log.lateMinutes || 0) > 0 && (
                          <span className="text-[10px] text-amber-600 font-bold">-{log.lateMinutes} dk Gecikme</span>
                        )}
                        {(log.earlyLeaveMinutes || 0) > 0 && (
                          <span className="text-[10px] text-whatsapp-600 font-bold">-{log.earlyLeaveMinutes} dk Erken Çıkış</span>
                        )}
                        {(log.overtimeMinutes || 0) > 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold">+{log.overtimeMinutes} dk Mesai</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {log.method === 'QR' ? (
                          <QrCode size={16} className="text-whatsapp-500" />
                        ) : log.method === 'Web' ? (
                          <MapPin size={16} className="text-emerald-500" />
                        ) : (
                          <Smartphone size={16} className="text-purple-500" />
                        )}
                        <span className="text-xs font-bold text-slate-500">{log.method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit",
                          log.location?.isWithinRadius !== false ? "bg-emerald-50 text-emerald-600" : "bg-whatsapp-50 text-whatsapp-600"
                        )}>
                          {log.location?.isWithinRadius !== false ? 'Alan İçinde' : 'Alan Dışında'}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <MapPin size={10} />
                          <span className="truncate max-w-[120px]">{log.location?.address || 'Bilinmiyor'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        log.status === 'normal' || log.status === 'on-time' ? "bg-emerald-50 text-emerald-600" : 
                        log.status === 'late' ? "bg-amber-50 text-amber-600" : 
                        log.status === 'overtime' ? "bg-emerald-100 text-emerald-700" :
                        log.status === 'leave' ? "bg-whatsapp-50 text-whatsapp-600" :
                        log.status === 'absent' ? "bg-whatsapp-100 text-whatsapp-700" :
                        "bg-whatsapp-50 text-whatsapp-600"
                      )}>
                        {log.status === 'normal' || log.status === 'on-time' ? 'Zamanında' : 
                         log.status === 'late' ? 'Geç Kaldı' : 
                         log.status === 'overtime' ? 'Fazla Mesai' :
                         log.status === 'leave' ? 'İzinli' :
                         log.status === 'absent' ? 'Gelmedi' :
                         log.status === 'working' ? 'İçeride' : 'Erken Çıkış'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
