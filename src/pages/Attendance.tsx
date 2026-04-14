import React from 'react';
import { 
  ArrowLeftRight,
  BarChart3,
  History
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import AttendanceLogs from './AttendanceLogs';
import AttendanceReports from './AttendanceReports';

export default function Attendance() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const activeTab = location.pathname.includes('/reports') ? 'reports' : 'logs';

  const tabs = [
    { id: 'logs', label: 'Giriş-Çıkış İşlemleri', icon: History, path: '/attendance/logs' },
    { id: 'reports', label: 'Giriş-Çıkış Raporları', icon: BarChart3, path: '/attendance/reports' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[100%] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Giriş - Çıkış Yönetimi</h1>
          <p className="text-slate-500">Günlük kayıtları ve aylık raporları yönetin.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200",
              activeTab === tab.id 
                ? "bg-white text-whatsapp-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'logs' && <AttendanceLogs />}
        {activeTab === 'reports' && <AttendanceReports />}
      </div>
    </div>
  );
}
