import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Building2,
  Users,
  Clock,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BranchStats {
  branchId: string;
  branchName: string;
  employeeCount: number;
  attendanceRate: number;
  totalWorkHours: number;
  lateCount: number;
}

export default function BranchReport() {
  const [branchData, setBranchData] = React.useState<BranchStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const branchSnap = await getDocs(collection(db, 'branches'));
        const branches = branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const empSnap = await getDocs(collection(db, 'employees'));
        const employees = empSnap.docs.map(doc => doc.data());

        const attendanceSnap = await getDocs(query(
          collection(db, 'attendance_records'),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        ));
        const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());

        const processedData: BranchStats[] = branches.map((branch: any) => {
          const branchEmployees = employees.filter(emp => emp.branchId === branch.id);
          const branchAttendance = attendanceRecords.filter(r => 
            branchEmployees.some(emp => emp.id === r.employeeId)
          );

          const totalPossibleAttendance = branchEmployees.length * 22; // Assumption: 22 working days
          const actualAttendance = branchAttendance.length;

          return {
            branchId: branch.id,
            branchName: branch.name,
            employeeCount: branchEmployees.length,
            attendanceRate: totalPossibleAttendance > 0 ? Math.round((actualAttendance / totalPossibleAttendance) * 100) : 0,
            totalWorkHours: Math.round(branchAttendance.reduce((acc, r) => acc + (r.workedMinutes || 0), 0) / 60),
            lateCount: branchAttendance.filter(r => r.status === 'late').length
          };
        });

        setBranchData(processedData);
      } catch (error) {
        console.error('Branch report fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const handleExportExcel = () => {
    const data = branchData.map(b => ({
      'Şube Adı': b.branchName,
      'Personel Sayısı': b.employeeCount,
      'Katılım Oranı (%)': b.attendanceRate,
      'Toplam Çalışma (Saat)': b.totalWorkHours,
      'Geç Kalma Sayısı': b.lateCount
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Şube Raporu");
    XLSX.writeFile(wb, `Sube_Raporu_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Şube / Departman Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih Aralığı: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 30);

    const tableData = branchData.map((b, i) => [
      i + 1,
      b.branchName,
      b.employeeCount,
      `${b.attendanceRate}%`,
      `${b.totalWorkHours}s`,
      b.lateCount
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Şube Adı', 'Personel', 'Katılım', 'Çalışma', 'Geç Kalma']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    doc.save(`Sube_Raporu_${startDate}_${endDate}.pdf`);
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Başlangıç Tarihi</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Bitiş Tarihi</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportExcel}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet size={18} />
              <span>Excel</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-600/20"
            >
              <FileDown size={18} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visual Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            Şube Bazlı Personel Dağılımı
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="branchName" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="employeeCount" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40}>
                  {branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600" />
            Katılım Oranları (%)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis 
                  type="number"
                  domain={[0, 100]}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis 
                  dataKey="branchName" 
                  type="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="attendanceRate" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube Adı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Personel Sayısı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Katılım Oranı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Toplam Çalışma</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Geç Kalma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-whatsapp-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : branchData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                branchData.map((b) => (
                  <tr key={b.branchId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{b.branchName}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{b.employeeCount}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              b.attendanceRate > 80 ? "bg-emerald-500" : b.attendanceRate > 50 ? "bg-amber-500" : "bg-whatsapp-500"
                            )}
                            style={{ width: `${b.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{b.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-indigo-600">{b.totalWorkHours} Saat</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-whatsapp-600">{b.lateCount}</td>
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
