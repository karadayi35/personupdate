import React from 'react';
import { 
  Clock, 
  Users, 
  Calendar, 
  Settings2,
  ChevronRight,
  Search,
  Filter,
  Plus,
  ArrowRightLeft,
  CalendarDays,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ShiftTemplates from './Shifts'; // Reusing the existing Shifts component as a tab
import ShiftAssignments from './ShiftAssignments';
import ShiftOverrides from './ShiftOverrides';
import BulkShiftActions from './BulkShiftActions';

type TabType = 'templates' | 'assignments' | 'overrides' | 'bulk';

export default function ShiftManagement() {
  const [activeTab, setActiveTab] = React.useState<TabType>('templates');

  const tabs = [
    { id: 'templates', label: 'Vardiya Şablonları', icon: Clock },
    { id: 'assignments', label: 'Personel Atamaları', icon: Users },
    { id: 'overrides', label: 'Günlük Değişiklikler', icon: CalendarDays },
    { id: 'bulk', label: 'Toplu İşlemler', icon: Settings2 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Değişiklik Otomasyonu</h1>
          <p className="text-slate-500">Çalışma saatlerini, personel atamalarını ve günlük değişiklikleri yönetin.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
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
        {activeTab === 'templates' && <ShiftTemplates />}
        {activeTab === 'assignments' && <ShiftAssignments />}
        {activeTab === 'overrides' && <ShiftOverrides />}
        {activeTab === 'bulk' && <BulkShiftActions />}
      </div>
    </div>
  );
}
