# Vercel Deployment Guide

Bu proje Vercel üzerinde hem frontend hem de backend (Express) olarak çalışacak şekilde yapılandırılmıştır.

## 1. Environment Variables (Ortam Değişkenleri)

Vercel Dashboard üzerinde aşağıdaki değişkenleri tanımlamanız gerekmektedir:

### Firebase Admin (Backend için)
*   `FIREBASE_PROJECT_ID`: Firebase proje ID'niz.
*   `FIREBASE_CLIENT_EMAIL`: Firebase Service Account email adresiniz.
*   `FIREBASE_PRIVATE_KEY`: Firebase Service Account private key'iniz. (Not: `-----BEGIN PRIVATE KEY-----\n...` formatında olmalıdır).

### Firebase Client (Frontend için - Opsiyonel, JSON fallback mevcuttur)
*   `VITE_FIREBASE_API_KEY`
*   `VITE_FIREBASE_AUTH_DOMAIN`
*   `VITE_FIREBASE_PROJECT_ID`
*   `VITE_FIREBASE_STORAGE_BUCKET`
*   `VITE_FIREBASE_MESSAGING_SENDER_ID`
*   `VITE_FIREBASE_APP_ID`
*   `VITE_FIREBASE_MEASUREMENT_ID`
*   `VITE_FIRESTORE_DATABASE_ID`

### Diğer Değişkenler
*   `RESEND_API_KEY`: Resend üzerinden mail göndermek için gerekli API anahtarı.
*   `NODE_ENV`: `production`

## 2. Deployment Adımları

1.  Projeyi GitHub'a pushlayın.
2.  Vercel üzerinde "New Project" diyerek repo'yu seçin.
3.  Vercel projeyi otomatik olarak bir **Vite** projesi olarak algılayacaktır.
4.  "Build and Output Settings" kısmına dokunmanıza gerek yoktur (Vercel `npm run build` ve `dist` klasörünü otomatik kullanır).
5.  Yukarıdaki Environment Variable'ları ekleyin.
6.  "Deploy" butonuna basın.

## 3. Önemli Notlar

*   `vercel.json` dosyası artık modern "Zero Config" yapısına uygundur ve sadece API yönlendirmelerini yönetir.
*   `server.ts` dosyası Vercel tarafından otomatik olarak bir Serverless Function olarak işlenir.
*   SPA (Single Page Application) yönlendirmeleri Vercel tarafından otomatik olarak `index.html`'e yönlendirilecek şekilde ayarlanmıştır.
