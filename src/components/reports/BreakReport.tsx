import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Coffee,
  Building2,
  User,
  Clock,
  TrendingUp,
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

interface BreakReportRecord {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  totalBreaks: number;
  totalMinutes: number;
  averageMinutes: number;
  irregularBreaks: number;
}

export default function BreakReport() {
  const [reportData, setReportData] = React.useState<BreakReportRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
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
        const employees = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const q = query(
          collection(db, 'break_records'),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        );
        
        const breakSnap = await getDocs(q);
        const breakRecords = breakSnap.docs.map(doc => doc.data());

        const processedData: BreakReportRecord[] = employees.map((emp: any) => {
          const empBreaks = breakRecords.filter(r => r.employeeId === emp.id);
          const totalMinutes = empBreaks.reduce((acc, r) => acc + (r.totalMinutes || 0), 0);

          return {
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode || `00000${emp.id.slice(0, 2)}`,
            branchName: emp.branchName || 'Merkez',
            totalBreaks: empBreaks.length,
            totalMinutes,
            averageMinutes: empBreaks.length > 0 ? Math.round(totalMinutes / empBreaks.length) : 0,
            irregularBreaks: empBreaks.filter(r => r.isIrregular).length
          };
        });

        setReportData(processedData);
      } catch (error) {
        console.error('Break report fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const filteredData = reportData.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || r.branchName === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  const handleExportExcel = () => {
    const data = filteredData.map(r => ({
      'Sicil No': r.employeeCode,
      'Personel': r.employeeName,
      'Şube': r.branchName,
      'Toplam Mola Sayısı': r.totalBreaks,
      'Toplam Mola Süresi (Dakika)': r.totalMinutes,
      'Ortalama Mola Süresi': r.averageMinutes,
      'Düzensiz Mola Sayısı': r.irregularBreaks
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mola Raporu");
    XLSX.writeFile(wb, `Mola_Raporu_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Mola Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih Aralığı: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 30);

    const tableData = filteredData.map((r, i) => [
      i + 1,
      r.employeeCode,
      r.employeeName,
      r.branchName,
      r.totalBreaks,
      `${r.totalMinutes} dk`,
      `${r.averageMinutes} dk`,
      r.irregularBreaks
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Şube', 'Mola Sayısı', 'Toplam Süre', 'Ortalama', 'Düzensiz']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] },
      styles: { fontSize: 8 }
    });

    doc.save(`Mola_Raporu_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet size={18} />
              <span>Excel'e Aktar</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-600/20"
            >
              <FileDown size={18} />
              <span>PDF İndir</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-slate-800/20"
            >
              <Printer size={18} />
              <span>Yazdır</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Coffee size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Mola</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredData.reduce((acc, r) => acc + r.totalBreaks, 0)}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Süre</p>
            <p className="text-2xl font-black text-slate-800">
              {Math.round(filteredData.reduce((acc, r) => acc + r.totalMinutes, 0) / 60)} Saat
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ortalama Mola</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredData.length > 0 ? Math.round(filteredData.reduce((acc, r) => acc + r.averageMinutes, 0) / filteredData.length) : 0} dk
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Düzensiz Mola</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredData.reduce((acc, r) => acc + r.irregularBreaks, 0)}
            </p>
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Şube</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Mola Sayısı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Toplam Süre</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Ortalama</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Düzensiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-whatsapp-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredData.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{r.employeeCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{r.employeeName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{r.branchName}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">{r.totalBreaks}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{r.totalMinutes} dk</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-whatsapp-600">{r.averageMinutes} dk</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        r.irregularBreaks > 0 ? "bg-whatsapp-100 text-whatsapp-600" : "bg-slate-100 text-slate-400"
                      )}>
                        {r.irregularBreaks} Hata
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
