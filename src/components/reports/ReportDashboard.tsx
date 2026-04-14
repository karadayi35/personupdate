import React from 'react';
import { 
  Users, 
  Calendar, 
  Coffee, 
  Clock, 
  Building2, 
  ArrowLeftRight, 
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { collection, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, subMonths, isToday, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function ReportDashboard() {
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    activeEmployees: 0,
    todayAttendance: 0,
    todayLate: 0,
    todayEarlyExit: 0,
    monthlyAttendanceRate: 0,
    monthlyLeaveDays: 0,
    monthlyBreakMinutes: 0
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

        // 1. Total Employees
        const empSnap = await getDocs(collection(db, 'employees'));
        const totalEmployees = empSnap.size;
        const activeEmployees = empSnap.docs.filter(d => d.data().status !== 'passive').length;

        // 2. Today's Attendance
        const attendanceSnap = await getDocs(query(collection(db, 'attendance_records'), where('date', '==', todayStr)));
        const todayAttendance = attendanceSnap.size;
        const todayLate = attendanceSnap.docs.filter(d => d.data().status === 'late').length;
        const todayEarlyExit = attendanceSnap.docs.filter(d => d.data().status === 'early-exit').length;

        // 3. Monthly Stats (Simplified)
        const monthlyAttendanceSnap = await getDocs(query(
          collection(db, 'attendance_records'), 
          where('date', '>=', monthStart),
          where('date', '<=', monthEnd)
        ));
        
        const monthlyLeaveSnap = await getDocs(query(
          collection(db, 'leave_records'),
          where('startDate', '>=', monthStart),
          where('startDate', '<=', monthEnd)
        ));
        const monthlyLeaveDays = monthlyLeaveSnap.docs.reduce((acc, d) => acc + (d.data().totalDays || 0), 0);

        const monthlyBreakSnap = await getDocs(query(
          collection(db, 'break_records'),
          where('date', '>=', monthStart),
          where('date', '<=', monthEnd)
        ));
        const monthlyBreakMinutes = monthlyBreakSnap.docs.reduce((acc, d) => acc + (d.data().totalMinutes || 0), 0);

        setStats({
          totalEmployees,
          activeEmployees,
          todayAttendance,
          todayLate,
          todayEarlyExit,
          monthlyAttendanceRate: totalEmployees > 0 ? Math.round((todayAttendance / totalEmployees) * 100) : 0,
          monthlyLeaveDays,
          monthlyBreakMinutes
        });
      } catch (error) {
        console.error('Dashboard stats error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const chartData = [
    { name: 'Pzt', attendance: 45, late: 5 },
    { name: 'Sal', attendance: 52, late: 3 },
    { name: 'Çar', attendance: 48, late: 8 },
    { name: 'Per', attendance: 61, late: 2 },
    { name: 'Cum', attendance: 55, late: 4 },
    { name: 'Cmt', attendance: 32, late: 1 },
    { name: 'Paz', attendance: 10, late: 0 },
  ];

  const pieData = [
    { name: 'Çalışan', value: stats.todayAttendance, color: '#10b981' },
    { name: 'İzinli', value: stats.monthlyLeaveDays / 30, color: '#f43f5e' },
    { name: 'Gelmedi', value: stats.totalEmployees - stats.todayAttendance, color: '#94a3b8' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Özet Dashboard</h2>
          <p className="text-sm text-slate-500">Sistem genelindeki kritik verilerin anlık özeti.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <Calendar size={16} className="text-whatsapp-600" />
          <span className="text-sm font-bold text-slate-700">{format(new Date(), 'dd MMMM yyyy', { locale: tr })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-[10px] font-bold">
              <TrendingUp size={12} />
              <span>+2%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Personel</p>
            <p className="text-3xl font-black text-slate-800">{stats.totalEmployees}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-[10px] font-bold">
              <TrendingUp size={12} />
              <span>{stats.monthlyAttendanceRate}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bugün Katılım</p>
            <p className="text-3xl font-black text-slate-800">{stats.todayAttendance}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div className="flex items-center gap-1 text-whatsapp-600 bg-whatsapp-50 px-2 py-1 rounded-lg text-[10px] font-bold">
              <TrendingDown size={12} />
              <span>-5%</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aylık Toplam İzin</p>
            <p className="text-3xl font-black text-slate-800">{stats.monthlyLeaveDays} Gün</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Coffee size={24} />
            </div>
            <div className="flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold">
              <span>Stabil</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aylık Mola Süresi</p>
            <p className="text-3xl font-black text-slate-800">{Math.round(stats.monthlyBreakMinutes / 60)} Saat</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Attendance Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Haftalık Katılım Analizi</h3>
            <select className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-600 outline-none">
              <option>Son 7 Gün</option>
              <option>Son 30 Gün</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="attendance" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="late" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Personel Dağılımı (Bugün)</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Çalışan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-whatsapp-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">İzinli</span>
              </div>
            </div>
          </div>
          <div className="h-80 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-3xl font-black text-slate-800">{stats.totalEmployees}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toplam</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts / Warnings */}
      <div className="bg-whatsapp-50 border border-whatsapp-100 rounded-3xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-whatsapp-600 text-white flex items-center justify-center shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-whatsapp-900">Dikkat Edilmesi Gerekenler</h4>
          <p className="text-sm text-whatsapp-700 leading-relaxed">
            Bugün {stats.todayLate} personel mesaiye geç kaldı ve {stats.todayEarlyExit} personel erken çıkış yaptı. 
            Ayrıca {stats.monthlyLeaveDays} günlük toplam izin kullanımı geçen aya göre %5 artış gösterdi.
          </p>
        </div>
      </div>
    </div>
  );
}
