import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Clock,
  Building2,
  User,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string | null;
  activeDays: number[];
}

export default function ShiftReport() {
  const [assignments, setAssignments] = React.useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [branches, setBranches] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const branchSnap = await getDocs(collection(db, 'branches'));
        setBranches(branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const empSnap = await getDocs(collection(db, 'employees'));
        const employees = empSnap.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        const shiftSnap = await getDocs(collection(db, 'shifts'));
        const shifts = shiftSnap.docs.reduce((acc: any, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        const unsub = onSnapshot(collection(db, 'employee_shift_assignments'), (snap) => {
          const data = snap.docs.map(doc => {
            const assignment = doc.data();
            const emp = employees[assignment.employeeId] || {};
            const shift = shifts[assignment.shiftId] || {};
            
            return {
              id: doc.id,
              employeeId: assignment.employeeId,
              employeeName: emp.name || 'Bilinmiyor',
              employeeCode: emp.employeeCode || `00000${assignment.employeeId.slice(0, 2)}`,
              branchName: emp.branchName || 'Merkez',
              shiftName: shift.name || 'Bilinmiyor',
              startTime: shift.startTime || '-',
              endTime: shift.endTime || '-',
              startDate: assignment.startDate,
              endDate: assignment.endDate,
              activeDays: assignment.activeDays || []
            } as ShiftAssignment;
          });
          setAssignments(data);
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error('Shift report fetch error:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch = a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || a.branchName === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const getDayName = (day: number) => {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[day];
  };

  const handleExportExcel = () => {
    const data = filteredAssignments.map(a => ({
      'Sicil No': a.employeeCode,
      'Personel': a.employeeName,
      'Şube': a.branchName,
      'Vardiya': a.shiftName,
      'Saatler': `${a.startTime} - ${a.endTime}`,
      'Başlangıç': a.startDate,
      'Bitiş': a.endDate || 'Süresiz',
      'Aktif Günler': a.activeDays.map(d => getDayName(d)).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vardiya Raporu");
    XLSX.writeFile(wb, `Vardiya_Raporu_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Vardiya Atama Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Oluşturulma Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);

    const tableData = filteredAssignments.map((a, i) => [
      i + 1,
      a.employeeCode,
      a.employeeName,
      a.shiftName,
      `${a.startTime} - ${a.endTime}`,
      a.startDate,
      a.endDate || 'Süresiz',
      a.activeDays.map(d => getDayName(d)).join(', ')
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Vardiya', 'Saatler', 'Başlangıç', 'Bitiş', 'Günler']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [147, 51, 234] },
      styles: { fontSize: 8 }
    });

    doc.save(`Vardiya_Raporu_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Şube</label>
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="all">Tüm Şubeler</option>
              {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">Personel Arama</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Ad Soyad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
              />
            </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Atama</p>
            <p className="text-2xl font-black text-slate-800">{filteredAssignments.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktif Planlar</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredAssignments.filter(a => !a.endDate || a.endDate >= format(new Date(), 'yyyy-MM-dd')).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Farklı Vardiyalar</p>
            <p className="text-2xl font-black text-slate-800">
              {new Set(filteredAssignments.map(a => a.shiftName)).size}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atanmamış Personel</p>
            <p className="text-2xl font-black text-slate-800">0</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vardiya</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saatler</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Başlangıç</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitiş</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Günler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-whatsapp-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{a.employeeCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{a.employeeName}</td>
                    <td className="px-6 py-4 text-sm font-bold text-purple-600">{a.shiftName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{a.startTime} - {a.endTime}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{a.startDate}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{a.endDate || 'Süresiz'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {a.activeDays.map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase">
                            {getDayName(d)}
                          </span>
                        ))}
                      </div>
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
