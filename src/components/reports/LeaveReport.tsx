import React from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  FileDown, 
  Loader2,
  Calendar,
  Building2,
  User,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  description: string;
}

export default function LeaveReport() {
  const [records, setRecords] = React.useState<LeaveRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [selectedType, setSelectedType] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [branches, setBranches] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const branchSnap = await getDocs(collection(db, 'branches'));
        setBranches(branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const q = query(
          collection(db, 'leave_records'),
          where('startDate', '>=', startDate),
          where('startDate', '<=', endDate),
          orderBy('startDate', 'desc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
          setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRecord)));
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error('Leave report fetch error:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || r.branchName === selectedBranch;
    const matchesType = selectedType === 'all' || r.leaveType === selectedType;
    return matchesSearch && matchesBranch && matchesType;
  });

  const handleExportExcel = () => {
    const data = filteredRecords.map(r => ({
      'Sicil No': r.employeeCode,
      'Personel': r.employeeName,
      'Şube': r.branchName,
      'İzin Türü': r.leaveType,
      'Başlangıç': format(parseISO(r.startDate), 'dd.MM.yyyy'),
      'Bitiş': format(parseISO(r.endDate), 'dd.MM.yyyy'),
      'Gün': r.totalDays,
      'Durum': r.status === 'approved' ? 'Onaylandı' : r.status === 'pending' ? 'Bekliyor' : 'Reddedildi',
      'Açıklama': r.description
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "İzin Raporu");
    XLSX.writeFile(wb, `Izin_Raporu_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('İzin Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih Aralığı: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 30);

    const tableData = filteredRecords.map((r, i) => [
      i + 1,
      r.employeeCode,
      r.employeeName,
      r.leaveType,
      format(parseISO(r.startDate), 'dd.MM.yyyy'),
      format(parseISO(r.endDate), 'dd.MM.yyyy'),
      r.totalDays,
      r.status === 'approved' ? 'Onaylandı' : 'Bekliyor'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'Tür', 'Başlangıç', 'Bitiş', 'Gün', 'Durum']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      styles: { fontSize: 8 }
    });

    doc.save(`Izin_Raporu_${startDate}_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
            <label className="text-xs font-bold text-slate-500 ml-1">İzin Türü</label>
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="all">Tüm Türler</option>
              <option value="Yıllık İzin">Yıllık İzin</option>
              <option value="Mazeret İzni">Mazeret İzni</option>
              <option value="Hastalık İzni">Hastalık İzni</option>
              <option value="Ücretsiz İzin">Ücretsiz İzin</option>
              <option value="Saatlik İzin">Saatlik İzin</option>
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
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam İzin Kaydı</p>
            <p className="text-2xl font-black text-slate-800">{filteredRecords.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Gün</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredRecords.reduce((acc, r) => acc + r.totalDays, 0)} Gün
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Farklı Personel</p>
            <p className="text-2xl font-black text-slate-800">
              {new Set(filteredRecords.map(r => r.employeeId)).size} Kişi
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Info size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Onay Bekleyen</p>
            <p className="text-2xl font-black text-slate-800">
              {filteredRecords.filter(r => r.status === 'pending').length}
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İzin Türü</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Başlangıç</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bitiş</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Gün</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-whatsapp-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{r.employeeCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{r.employeeName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{r.leaveType}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {format(parseISO(r.startDate), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {format(parseISO(r.endDate), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-900">{r.totalDays}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        r.status === 'approved' ? "bg-emerald-100 text-emerald-600" :
                        r.status === 'pending' ? "bg-amber-100 text-amber-600" :
                        "bg-whatsapp-100 text-whatsapp-600"
                      )}>
                        {r.status === 'approved' ? 'Onaylandı' : r.status === 'pending' ? 'Bekliyor' : 'Reddedildi'}
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
