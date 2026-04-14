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
  Clock,
  ArrowRightToLine,
  ArrowLeftFromLine,
  MapPin,
  Smartphone,
  QrCode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EntryExitLog {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchName: string;
  type: 'check-in' | 'check-out';
  timestamp: any;
  method: string;
  location?: string;
  deviceInfo?: string;
}

export default function EntryExitDetailReport() {
  const [logs, setLogs] = React.useState<EntryExitLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filters
  const [startDate, setStartDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
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

        // In a real app, we might have a separate 'attendance_logs' collection
        // For now, we'll derive it from attendance_records or assume a logs collection exists
        // Let's assume 'attendance_logs' exists for detailed tracking
        const q = query(
          collection(db, 'attendance_logs'),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('timestamp', 'desc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
          setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntryExitLog)));
          setLoading(false);
        }, (error) => {
          // If collection doesn't exist, fallback to empty
          console.warn('Attendance logs collection not found, using empty state');
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error('Entry-Exit report fetch error:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         l.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || l.branchName === selectedBranch;
    const matchesType = selectedType === 'all' || l.type === selectedType;
    return matchesSearch && matchesBranch && matchesType;
  });

  const handleExportExcel = () => {
    const data = filteredLogs.map(l => ({
      'Sicil No': l.employeeCode,
      'Personel': l.employeeName,
      'Şube': l.branchName,
      'İşlem': l.type === 'check-in' ? 'Giriş' : 'Çıkış',
      'Tarih': format(l.timestamp.toDate(), 'dd.MM.yyyy'),
      'Saat': format(l.timestamp.toDate(), 'HH:mm:ss'),
      'Yöntem': l.method,
      'Konum': l.location || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giriş-Çıkış Detay");
    XLSX.writeFile(wb, `Giris_Cikis_Detay_${startDate}_${endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Giriş-Çıkış Detay Raporu', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Tarih Aralığı: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 30);

    const tableData = filteredLogs.map((l, i) => [
      i + 1,
      l.employeeCode,
      l.employeeName,
      l.type === 'check-in' ? 'Giriş' : 'Çıkış',
      format(l.timestamp.toDate(), 'dd.MM.yyyy HH:mm:ss'),
      l.method,
      l.location || '-'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Sicil No', 'Personel', 'İşlem', 'Zaman', 'Yöntem', 'Konum']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 8 }
    });

    doc.save(`Giris_Cikis_Detay_${startDate}_${endDate}.pdf`);
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
            <label className="text-xs font-bold text-slate-500 ml-1">İşlem Türü</label>
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
            >
              <option value="all">Tümü</option>
              <option value="check-in">Girişler</option>
              <option value="check-out">Çıkışlar</option>
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

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sicil No</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">İşlem</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zaman</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yöntem</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Konum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-whatsapp-600 mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{l.employeeCode}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{l.employeeName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {l.type === 'check-in' ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ArrowRightToLine size={16} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-whatsapp-50 text-whatsapp-600 flex items-center justify-center">
                            <ArrowLeftFromLine size={16} />
                          </div>
                        )}
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          l.type === 'check-in' ? "text-emerald-600" : "text-whatsapp-600"
                        )}>
                          {l.type === 'check-in' ? 'Giriş' : 'Çıkış'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {format(l.timestamp.toDate(), 'dd MMM yyyy HH:mm:ss', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        {l.method === 'QR' ? <QrCode size={14} /> : <Smartphone size={14} />}
                        <span className="text-xs font-medium">{l.method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-500">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="text-xs font-medium">{l.location || 'Bilinmiyor'}</span>
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
