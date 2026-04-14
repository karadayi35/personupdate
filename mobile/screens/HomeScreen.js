import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'lucide-react-native';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState('idle'); // idle, working
  const [currentRecord, setCurrentRecord] = React.useState(null);
  const [shiftInfo, setShiftInfo] = React.useState(null);
  const [isDayOff, setIsDayOff] = React.useState(false);
  const [fetchingShift, setFetchingShift] = React.useState(true);
  const [employeeData, setEmployeeData] = React.useState(null);
  const [branchData, setBranchData] = React.useState(null);

  React.useEffect(() => {
    fetchEmployeeAndBranch();
    fetchShiftInfo();
  }, []);

  const fetchEmployeeAndBranch = async () => {
    try {
      const empQ = query(
        collection(db, 'employees'),
        where('authUid', '==', auth.currentUser.uid)
      );
      const empSnap = await getDocs(empQ);
      
      if (!empSnap.empty) {
        const empDoc = empSnap.docs[0];
        const emp = empDoc.data();
        setEmployeeData({ id: empDoc.id, ...emp });
        
        if (emp.branchId) {
          const branchRef = doc(db, 'branches', emp.branchId);
          const branchSnap = await getDoc(branchRef);
          if (branchSnap.exists()) {
            setBranchData({ id: branchSnap.id, ...branchSnap.data() });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching employee/branch:', error);
    }
  };

  const fetchShiftInfo = async () => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const dayOfWeek = today.getDay(); // 0 (Paz) - 6 (Cmt)

      // 1. Check Overrides
      const overrideQ = query(
        collection(db, 'shift_overrides'),
        where('employeeId', '==', auth.currentUser.uid),
        where('date', '==', dateStr)
      );
      const overrideSnap = await getDocs(overrideQ);
      
      if (!overrideSnap.empty) {
        const override = overrideSnap.docs[0].data();
        if (override.overrideType === 'day_off') {
          setIsDayOff(true);
          setShiftInfo({ name: 'Hafta Tatili', startTime: '-', endTime: '-' });
        } else {
          setShiftInfo({
            name: 'Özel Vardiya',
            startTime: override.customStartTime,
            endTime: override.customEndTime
          });
        }
        setFetchingShift(false);
        return;
      }

      // 2. Check Assignments
      const assignmentQ = query(
        collection(db, 'employee_shift_assignments'),
        where('employeeId', '==', auth.currentUser.uid),
        where('isActive', '==', true),
        where('startDate', '<=', dateStr)
      );
      const assignmentSnap = await getDocs(assignmentQ);
      
      const activeAssignment = assignmentSnap.docs.find(doc => {
        const data = doc.data();
        return (!data.endDate || data.endDate >= dateStr) && data.activeDays.includes(dayOfWeek);
      });

      if (activeAssignment) {
        const assignmentData = activeAssignment.data();
        const shiftRef = doc(db, 'shifts', assignmentData.shiftId);
        const shiftSnap = await getDoc(shiftRef);
        
        if (shiftSnap.exists()) {
          const shiftData = shiftSnap.data();
          setShiftInfo({
            name: shiftData.name,
            startTime: shiftData.startTime,
            endTime: shiftData.endTime
          });
          setFetchingShift(false);
          return;
        }
      }

      // No shift found for today
      setIsDayOff(true);
      setShiftInfo({ name: 'Planlı Vardiya Yok', startTime: '-', endTime: '-' });

    } catch (error) {
      console.error('Error fetching shift info:', error);
    } finally {
      setFetchingShift(false);
    }
  };

  const handleCheckIn = async (method = 'Manual') => {
    setLoading(true);
    try {
      // 1. Konum İzni Al
      let { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Hata', 'Konum izni verilmedi.');
        return;
      }

      // 2. Mevcut Konumu Al
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // 3. Şube Konum Kontrolü
      if (!branchData) {
        Alert.alert('Hata', 'Bağlı olduğunuz şube bilgisi bulunamadı. Lütfen yönetici ile iletişime geçin.');
        return;
      }

      const distance = calculateDistance(latitude, longitude, branchData.lat, branchData.lng);
      
      if (distance > branchData.radius) {
        Alert.alert('Hata', `${branchData.name} kapsama alanı dışındasınız. (${Math.round(distance)}m)\nİzin verilen: ${branchData.radius}m`);
        return;
      }

      // 4. Firestore'a Kaydet
      const record = {
        employeeId: auth.currentUser.uid,
        employeeName: employeeData?.name || auth.currentUser.displayName || 'Personel',
        branchId: branchData.id,
        branchName: branchData.name,
        checkIn: serverTimestamp(),
        checkOut: null,
        method: method,
        location: { lat: latitude, lng: longitude },
        status: 'working'
      };

      const docRef = await addDoc(collection(db, 'attendance_records'), record);
      setCurrentRecord(docRef.id);
      setStatus('working');
      Alert.alert('Başarılı', 'Giriş yapıldı.');

    } catch (error) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentRecord) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'attendance_records', currentRecord);
      await updateDoc(docRef, {
        checkOut: serverTimestamp(),
        status: 'completed'
      });
      setStatus('idle');
      setCurrentRecord(null);
      Alert.alert('Başarılı', 'Çıkış yapıldı.');
    } catch (error) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hoş Geldin,</Text>
        <Text style={styles.name}>{employeeData?.name || auth.currentUser?.email}</Text>
        <Text style={styles.branchSub}>{branchData?.name || 'Şube Belirtilmemiş'}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.statusLabel}>Bugünkü Vardiyanız</Text>
          <Text style={styles.branchTag}>{branchData?.name || 'Genel'}</Text>
        </View>
        {fetchingShift ? (
          <ActivityIndicator color="#3b82f6" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        ) : isDayOff ? (
          <View>
            <Text style={[styles.statusValue, { color: '#ef4444' }]}>Hafta Tatili</Text>
            <Text style={styles.dayOffText}>Bugün Hafta Tatiliniz</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.shiftName}>{shiftInfo?.name || 'Vardiya Atanmamış'}</Text>
            <Text style={styles.statusValue}>{shiftInfo?.startTime} - {shiftInfo?.endTime}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.statusLabel}>Mevcut Durum</Text>
        <Text style={[styles.statusValue, { color: status === 'working' ? '#22c55e' : '#94a3b8' }]}>
          {status === 'working' ? 'Mesaide' : 'Dışarıda'}
        </Text>
      </View>

      <View style={styles.actions}>
        {status === 'idle' ? (
          <TouchableOpacity 
            style={[styles.button, styles.checkInButton, (isDayOff || fetchingShift) && styles.disabledButton]} 
            onPress={() => handleCheckIn()}
            disabled={loading || isDayOff || fetchingShift}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isDayOff ? 'Hafta Tatili' : 'Giriş Yap'}</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.checkOutButton]} 
            onPress={handleCheckOut}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Çıkış Yap</Text>}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.qrButton} 
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Camera color="#3b82f6" size={24} />
          <Text style={styles.qrText}>QR Kod ile Giriş</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  header: { marginTop: 48, marginBottom: 32 },
  welcome: { color: '#94a3b8', fontSize: 16 },
  name: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  branchSub: { color: '#3b82f6', fontSize: 14, marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: '#1e293b', padding: 24, borderRadius: 20, marginBottom: 32 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusLabel: { color: '#94a3b8', fontSize: 14 },
  branchTag: { backgroundColor: '#3b82f620', color: '#3b82f6', fontSize: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: 'bold' },
  statusValue: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  shiftName: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dayOffText: { color: '#ef4444', fontSize: 14, marginTop: 4, fontWeight: '500' },
  actions: { gap: 16 },
  button: { height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  checkInButton: { backgroundColor: '#3b82f6' },
  disabledButton: { backgroundColor: '#334155', opacity: 0.7 },
  checkOutButton: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  qrButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    height: 64, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#3b82f6' 
  },
  qrText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' }
});
