import React from 'react';
import { 
  Coffee, 
  BarChart3, 
  History, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  FileDown, 
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Info,
  X,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { BreakRecord } from '@/types/breaks';
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { useSearchParams } from 'react-router-dom';

// Sub-components
import BreakTracking from '@/components/breaks/BreakTracking';
import BreakReporting from '@/components/breaks/BreakReporting';
import BranchBreakManagement from '@/components/breaks/BranchBreakManagement';
import EmployeeBreakOverrides from '@/components/breaks/EmployeeBreakOverrides';

export default function BreakManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'tracking' | 'reporting' | 'branch' | 'overrides') || 'tracking';

  const setActiveTab = (tab: 'tracking' | 'reporting' | 'branch' | 'overrides') => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Mola Yönetimi</h1>
          <p className="text-sm text-slate-500">Personel mola kayıtlarını takip edin ve raporlayın.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('tracking')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'tracking' 
              ? "bg-white text-whatsapp-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <History size={18} />
          <span>Mola Kayıt ve Takip</span>
        </button>
        <button
          onClick={() => setActiveTab('branch')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'branch' 
              ? "bg-white text-whatsapp-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <Building2 size={18} />
          <span>Şube Mola Tanımları</span>
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'overrides' 
              ? "bg-white text-whatsapp-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <User size={18} />
          <span>Personel İstisnaları</span>
        </button>
        <button
          onClick={() => setActiveTab('reporting')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'reporting' 
              ? "bg-white text-whatsapp-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <BarChart3 size={18} />
          <span>Mola Raporlama Sistemi</span>
        </button>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'tracking' ? (
          <BreakTracking />
        ) : activeTab === 'branch' ? (
          <BranchBreakManagement />
        ) : activeTab === 'overrides' ? (
          <EmployeeBreakOverrides />
        ) : (
          <BreakReporting />
        )}
      </div>
    </div>
  );
}
