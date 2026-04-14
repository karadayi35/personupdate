# PersoTrack Mobil Uygulama Kurulumu

Bu uygulama **Expo** kullanılarak geliştirilmiştir. Hem Android hem iOS platformlarında çalışır.

## Kurulum Adımları

1. **Expo CLI Yükleyin:**
   ```bash
   npm install -g expo-cli
   ```

2. **Yeni Proje Oluşturun:**
   ```bash
   npx create-expo-app PersoTrackMobile
   cd PersoTrackMobile
   ```

3. **Gerekli Bağımlılıkları Yükleyin:**
   ```bash
   npx expo install firebase expo-location expo-barcode-scanner react-native-safe-area-context react-native-screens @react-navigation/native @react-navigation/stack lucide-react-native
   ```

4. **Dosyaları Kopyalayın:**
   Bu projedeki `mobile/` klasöründeki dosyaları yeni oluşturduğunuz Expo projesine kopyalayın.

5. **Firebase Yapılandırması:**
   `mobile/firebase.js` dosyasındaki `firebaseConfig` nesnesini kendi Firebase projenizden aldığınız bilgilerle güncelleyin.

6. **Uygulamayı Çalıştırın:**
   ```bash
   npx expo start
   ```

## Özellikler
- **GPS Doğrulaması:** Şube konumuna göre giriş-çıkış kontrolü.
- **QR Kod Tarama:** Dinamik QR kod ile hızlı giriş.
- **İzin Talebi:** Uygulama üzerinden izin formu doldurma.
- **Vardiya Takibi:** Günlük çalışma süresi ve kalan süre gösterimi.
