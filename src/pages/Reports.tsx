import React from 'react';
import { 
  BarChart3, 
  Users, 
  Calendar, 
  Coffee, 
  Clock, 
  Building2, 
  ArrowLeftRight, 
  LayoutDashboard,
  ChevronRight,
  Search,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  FileDown,
  Loader2,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

// Sub-components (to be created)
import ReportDashboard from '@/components/reports/ReportDashboard';
import AttendanceReport from '@/components/reports/AttendanceReport';
import PayrollReport from '@/components/reports/PayrollReport';
import LeaveReport from '@/components/reports/LeaveReport';
import BreakReport from '@/components/reports/BreakReport';
import ShiftReport from '@/components/reports/ShiftReport';
import BranchReport from '@/components/reports/BranchReport';
import EntryExitDetailReport from '@/components/reports/EntryExitDetailReport';

import AutoReportModule from '@/components/reports/AutoReportModule';
import SalaryCalculationModule from '@/components/reports/SalaryCalculationModule';

const REPORT_TYPES = [
  { id: 'dashboard', label: 'Özet Dashboard', icon: LayoutDashboard, color: 'text-whatsapp-600', bg: 'bg-whatsapp-50' },
  { id: 'attendance', label: 'Personel Devam Raporu', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'payroll', label: 'Puantaj Raporu', icon: FileSpreadsheet, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'leave', label: 'İzin Raporu', icon: Calendar, color: 'text-whatsapp-600', bg: 'bg-whatsapp-50' },
  { id: 'break', label: 'Mola Raporu', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'shift', label: 'Vardiya Raporu', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'branch', label: 'Şube / Departman Raporu', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'entry-exit', label: 'Giriş-Çıkış Detay Raporu', icon: ArrowLeftRight, color: 'text-slate-600', bg: 'bg-slate-50' },
  { id: 'auto-report', label: 'Otomatik Rapor Yollama', icon: FileDown, color: 'text-whatsapp-600', bg: 'bg-whatsapp-50' },
  { id: 'salary', label: 'Maaş Hesaplama', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReport = searchParams.get('type') || 'dashboard';

  const setActiveReport = (type: string) => {
    setSearchParams({ type });
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'dashboard': return <ReportDashboard />;
      case 'attendance': return <AttendanceReport />;
      case 'payroll': return <PayrollReport />;
      case 'leave': return <LeaveReport />;
      case 'break': return <BreakReport />;
      case 'shift': return <ShiftReport />;
      case 'branch': return <BranchReport />;
      case 'entry-exit': return <EntryExitDetailReport />;
      case 'auto-report': return <AutoReportModule />;
      case 'salary': return <SalaryCalculationModule />;
      default: return <ReportDashboard />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 size={20} className="text-whatsapp-600" />
              Rapor Menüsü
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Lütfen görüntülemek istediğiniz raporu seçin.</p>
          </div>
          <nav className="p-3 space-y-1">
            {REPORT_TYPES.map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 group",
                  activeReport === report.id
                    ? "bg-whatsapp-50 text-whatsapp-600 shadow-sm shadow-whatsapp-600/5"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    activeReport === report.id ? "bg-white shadow-sm" : report.bg
                  )}>
                    <report.icon size={20} className={report.color} />
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    activeReport === report.id ? "text-whatsapp-600" : "text-slate-600"
                  )}>
                    {report.label}
                  </span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={cn(
                    "transition-transform duration-200",
                    activeReport === report.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                  )} 
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Info Card */}
        <div className="bg-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl shadow-slate-800/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <BarChart3 size={24} className="text-whatsapp-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Raporlama Rehberi</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tüm raporlar gerçek zamanlı verilerle oluşturulur. Filtreleri kullanarak verileri daraltabilir ve dışa aktarabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        {renderReport()}
      </main>
    </div>
  );
}
