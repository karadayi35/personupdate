import React from 'react';
import { 
  DollarSign, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Calculator,
  History,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Calendar,
  Clock,
  Wallet,
  ArrowRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  eachDayOfInterval, 
  isWeekend,
  differenceInMinutes
} from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface SalaryConfig {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'monthly' | 'daily' | 'hourly';
  baseAmount: number;
  overtimeRate: number;
  weekendRate: number;
  holidayRate: number;
  latenessDeductionRate: number;
}

interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  period: string;
  totalDays: number;
  totalHours: number;
  overtimeHours: number;
  baseSalary: number;
  overtimePay: number;
  deductions: number;
  bonuses: number;
  netSalary: number;
  status: 'calculated' | 'paid';
  createdAt: any;
  notes?: string;
}

export default function SalaryCalculationModule() {
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [configs, setConfigs] = React.useState<SalaryConfig[]>([]);
  const [records, setRecords] = React.useState<SalaryRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [calculating, setCalculating] = React.useState(false);
  
  // Filters & State
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [view, setView] = React.useState<'list' | 'config' | 'history'>('list');
  
  // Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<any>(null);
  const [isCalcModalOpen, setIsCalcModalOpen] = React.useState(false);
  const [calcResult, setCalcResult] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Employees
        const empSnap = await getDocs(collection(db, 'employees'));
        const empList = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEmployees(empList);

        // Fetch Configs
        const unsubConfigs = onSnapshot(collection(db, 'salary_configs'), (snap) => {
          setConfigs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryConfig)));
        });

        // Fetch Records
        const unsubRecords = onSnapshot(
          query(collection(db, 'salary_records'), orderBy('createdAt', 'desc')),
          (snap) => {
            setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryRecord)));
            setLoading(false);
          }
        );

        return () => {
          unsubConfigs();
          unsubRecords();
        };
      } catch (error) {
        console.error('Salary module fetch error:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      employeeId: formData.get('employeeId'),
      employeeName: employees.find(emp => emp.id === formData.get('employeeId'))?.name,
      type: formData.get('type'),
      baseAmount: Number(formData.get('baseAmount')),
      overtimeRate: Number(formData.get('overtimeRate')),
      weekendRate: Number(formData.get('weekendRate')),
      holidayRate: Number(formData.get('holidayRate')),
      latenessDeductionRate: Number(formData.get('latenessDeductionRate')),
    };

    try {
      if (editingConfig) {
        await updateDoc(doc(db, 'salary_configs', editingConfig.id), data);
      } else {
        // Use setDoc with employeeId as ID to ensure one config per employee
        await setDoc(doc(db, 'salary_configs', data.employeeId as string), data);
      }
      setIsConfigModalOpen(false);
      setEditingConfig(null);
    } catch (error) {
      console.error('Error saving salary config:', error);
    }
  };

  const calculateSalary = async (employee: any) => {
    const config = configs.find(c => c.employeeId === employee.id);
    if (!config) {
      alert('Bu personel için maaş yapılandırması bulunamadı.');
      return;
    }

    setCalculating(true);
    try {
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(monthStart);
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');

      // Fetch Attendance
      const attSnap = await getDocs(query(
        collection(db, 'attendance_records'),
        where('employeeId', '==', employee.id),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      ));
      const attendance = attSnap.docs.map(doc => doc.data());

      // Fetch Leaves
      const leaveSnap = await getDocs(query(
        collection(db, 'leave_records'),
        where('employeeId', '==', employee.id),
        where('startDate', '<=', endStr)
      ));
      const leaves = leaveSnap.docs.map(doc => doc.data()).filter(l => l.endDate >= startStr);

      // Calculation Logic
      let totalWorkMinutes = 0;
      let totalLateMinutes = 0;
      let overtimeMinutes = 0;
      let workDays = 0;
      let leaveDays = 0;

      attendance.forEach((rec: any) => {
        if (rec.workedMinutes) totalWorkMinutes += rec.workedMinutes;
        if (rec.lateMinutes) totalLateMinutes += rec.lateMinutes;
        if (rec.overtimeMinutes) overtimeMinutes += rec.overtimeMinutes;
        workDays++;
      });

      leaves.forEach((l: any) => {
        // Simplified leave day calculation within the month
        leaveDays += l.totalDays || 0;
      });

      let baseSalary = 0;
      if (config.type === 'monthly') {
        baseSalary = config.baseAmount;
      } else if (config.type === 'daily') {
        baseSalary = config.baseAmount * workDays;
      } else {
        baseSalary = config.baseAmount * (totalWorkMinutes / 60);
      }

      const overtimePay = (overtimeMinutes / 60) * (config.type === 'hourly' ? config.baseAmount : (config.baseAmount / 225)) * config.overtimeRate;
      const deductions = totalLateMinutes * config.latenessDeductionRate;
      const netSalary = baseSalary + overtimePay - deductions;

      setCalcResult({
        employee,
        config,
        period: selectedMonth,
        totalDays: workDays,
        totalHours: Math.round(totalWorkMinutes / 60),
        overtimeHours: Math.round(overtimeMinutes / 60),
        baseSalary: Math.round(baseSalary),
        overtimePay: Math.round(overtimePay),
        deductions: Math.round(deductions),
        bonuses: 0,
        netSalary: Math.round(netSalary),
        notes: ''
      });
      setIsCalcModalOpen(true);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setCalculating(false);
    }
  };

  const saveSalaryRecord = async () => {
    try {
      await addDoc(collection(db, 'salary_records'), {
        ...calcResult,
        employeeId: calcResult.employee.id,
        employeeName: calcResult.employee.name,
        employeeCode: calcResult.employee.employeeCode,
        branchName: calcResult.employee.branchName,
        status: 'calculated',
        createdAt: serverTimestamp()
      });
      setIsCalcModalOpen(false);
      setCalcResult(null);
      alert('Maaş kaydı başarıyla kaydedildi.');
    } catch (error) {
      console.error('Error saving salary record:', error);
    }
  };

  const handleExportExcel = () => {
    const data = records.map(r => ({
      'Dönem': r.period,
      'Sicil No': r.employeeCode,
      'Personel': r.employeeName,
      'Şube': r.branchName,
      'Çalışma Günü': r.totalDays,
      'Çalışma Saati': r.totalHours,
      'Fazla Mesai (Saat)': r.overtimeHours,
      'Temel Maaş': r.baseSalary,
      'Mesai Ücreti': r.overtimePay,
      'Kesintiler': r.deductions,
      'Ek Ödemeler': r.bonuses,
      'Net Maaş': r.netSalary
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Maaş Raporu");
    XLSX.writeFile(wb, `Maas_Raporu_${selectedMonth}.xlsx`);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || emp.branchName === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-whatsapp-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Maaş Hesaplama Modülü</h2>
          <p className="text-sm text-slate-500">Puantaj verilerine göre otomatik maaş ve bordro yönetimi.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setView('config')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
              view === 'config' ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <Settings size={18} />
            <span>Yapılandırmalar</span>
          </button>
          <button 
            onClick={() => setView('history')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
              view === 'history' ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <History size={18} />
            <span>Geçmiş Kayıtlar</span>
          </button>
          <button 
            onClick={() => setView('list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
              view === 'list' ? "bg-whatsapp-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <Calculator size={18} />
            <span>Hesaplama Ekranı</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Maaş Dönemi</label>
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Şube</label>
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="all">Tüm Şubeler</option>
              {Array.from(new Set(employees.map(e => e.branchName))).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Personel Arama</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Ad Soyad veya Sicil..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportExcel}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet size={18} />
              <span>Excel</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-slate-800/20"
            >
              <Printer size={18} />
              <span>Yazdır</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {view === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maaş Tipi</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const config = configs.find(c => c.employeeId === emp.id);
                  const hasRecord = records.some(r => r.employeeId === emp.id && r.period === selectedMonth);
                  
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                            {emp.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">{emp.employeeCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{emp.branchName}</td>
                      <td className="px-6 py-4">
                        {config ? (
                          <span className="text-xs font-bold text-indigo-600 capitalize">
                            {config.type === 'monthly' ? 'Aylık' : config.type === 'daily' ? 'Günlük' : 'Saatlik'}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic">Tanımlanmamış</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasRecord ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle2 size={12} />
                            <span>Hesaplandı</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
                            <AlertCircle size={12} />
                            <span>Bekliyor</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => calculateSalary(emp)}
                          disabled={!config || calculating}
                          className="inline-flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-whatsapp-600/20 disabled:opacity-50"
                        >
                          <Calculator size={14} />
                          <span>Hesapla</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'config' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Maaş Yapılandırmaları</h3>
            <button 
              onClick={() => { setEditingConfig(null); setIsConfigModalOpen(true); }}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all"
            >
              <Plus size={18} />
              <span>Yeni Yapılandırma</span>
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tip</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maaş/Ücret</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mesai Çarpanı</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{config.employeeName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 capitalize">{config.type}</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{config.baseAmount.toLocaleString('tr-TR')} ₺</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">x{config.overtimeRate}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setEditingConfig(config); setIsConfigModalOpen(true); }}
                          className="p-2 hover:bg-whatsapp-50 text-whatsapp-600 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dönem</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Net Maaş</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{record.period}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{record.employeeName}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-emerald-600">{record.netSalary.toLocaleString('tr-TR')} ₺</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2.5 py-1 rounded-full bg-whatsapp-50 text-whatsapp-600 text-[10px] font-bold uppercase">Hesaplandı</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all">
                      <FileDown size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-whatsapp-600 text-white flex items-center justify-center">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Maaş Yapılandırması</h3>
                  <p className="text-sm text-slate-500">Personel bazlı ücret ayarları.</p>
                </div>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveConfig} className="p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 ml-1">Personel</label>
                <select 
                  name="employeeId"
                  required
                  defaultValue={editingConfig?.employeeId}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                >
                  <option value="">Seçiniz...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Maaş Tipi</label>
                  <select 
                    name="type"
                    required
                    defaultValue={editingConfig?.type || 'monthly'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  >
                    <option value="monthly">Aylık Maaş</option>
                    <option value="daily">Günlük Ücret</option>
                    <option value="hourly">Saatlik Ücret</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Temel Tutar (₺)</label>
                  <input 
                    type="number"
                    name="baseAmount"
                    required
                    defaultValue={editingConfig?.baseAmount}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Fazla Mesai Çarpanı</label>
                  <input 
                    type="number"
                    step="0.1"
                    name="overtimeRate"
                    required
                    defaultValue={editingConfig?.overtimeRate || 1.5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Geç Kalma Kesintisi (Dakika/₺)</label>
                  <input 
                    type="number"
                    step="0.1"
                    name="latenessDeductionRate"
                    required
                    defaultValue={editingConfig?.latenessDeductionRate || 1}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 mt-4">
                Kaydet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Calculation Result Modal */}
      {isCalcModalOpen && calcResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Calculator size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Maaş Hesaplama Özeti</h3>
                  <p className="text-sm opacity-80">{calcResult.employee.name} - {calcResult.period}</p>
                </div>
              </div>
              <button onClick={() => setIsCalcModalOpen(false)} className="hover:opacity-70">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Çalışma Günü</p>
                  <p className="text-xl font-black text-slate-800">{calcResult.totalDays} Gün</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Çalışma Saati</p>
                  <p className="text-xl font-black text-slate-800">{calcResult.totalHours} Saat</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fazla Mesai</p>
                  <p className="text-xl font-black text-emerald-600">{calcResult.overtimeHours} Saat</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Temel Maaş / Ücret</span>
                  <span className="text-sm font-bold text-slate-800">{calcResult.baseSalary.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Fazla Mesai Ücreti</span>
                  <span className="text-sm font-bold text-emerald-600">+{calcResult.overtimePay.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Kesintiler (Geç Kalma vb.)</span>
                  <span className="text-sm font-bold text-whatsapp-600">-{calcResult.deductions.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-emerald-50 px-4 rounded-2xl">
                  <span className="text-lg font-bold text-emerald-900">Net Ödenecek Tutar</span>
                  <span className="text-2xl font-black text-emerald-600">{calcResult.netSalary.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button 
                  onClick={() => setIsCalcModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  Kapat
                </button>
                <button 
                  onClick={saveSalaryRecord}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20"
                >
                  Kaydı Onayla ve Sakla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
