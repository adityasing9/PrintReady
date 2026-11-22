# PrintReady — Upload once. Print anywhere.

[![Version](https://img.shields.io/badge/version-1.0.11-blue.svg)](https://github.com/adityasing9/PrintReady/releases/tag/v1.0.11)
[![Android](https://img.shields.io/badge/platform-Android%20%7C%20Web%20PWA-green.svg)](https://github.com/adityasing9/PrintReady/releases/latest)
[![React](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite%20%2B%20Tailwind-61dafb.svg)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/native-Capacitor%208%20(API%2034)-119eff.svg)](https://capacitorjs.com/)

**PrintReady** is a full-stack document wallet, smart printing workspace, print shop directory, and marketplace platform. It allows users to pre-upload documents, configure exact print specifications, and dispatch actual binary files directly to neighborhood print shop counters via WhatsApp, Email, or native share sheet in a single tap—without relying on text links or USB drives.

---

## 📱 Latest Android Release (v1.0.11)

Get the latest signed, update-compatible Android APK directly:

- 🚀 **[Download PrintReady-v1.0.11.apk (Direct Download)](https://github.com/adityasing9/PrintReady/releases/download/v1.0.11/PrintReady-v1.0.11.apk)**
- 📦 **[View GitHub Releases & Changelog](https://github.com/adityasing9/PrintReady/releases)**

> **Smooth Updates:** All builds are signed with a permanent release keystore (`printready-release.jks`), allowing in-app auto-updates without package signature conflicts or uninstalls.

---

## 🌟 Key Features

### 1. Direct Multi-File Dispatch (WhatsApp & Email)
- **Pure Binary File Transfer:** Dispatches actual files (PDF, JPG, PNG, DOCX) directly to the print counter via native Android `ACTION_SEND_MULTIPLE`, `FileProvider`, and `ClipData` intents.
- **Direct Shop Targeting:** Automatically opens the WhatsApp chat of the saved/selected shop (`@s.whatsapp.net`) with all selected documents attached ready for sending.
- **Zero Broken Text Links:** Eliminates cloud link fallbacks; documents travel straight from your phone's local storage to the print shop.

### 2. Print Queue & Smart Cost Estimation
- **Pre-Upload Before Leaving:** Upload all files before heading out to the photocopy or campus print counter.
- **Per-Document Specifications:** Set copies, color mode (Color / B&W), paper size (A4, A3, Legal, Letter), orientation, and print sides (Duplex / Single).
- **Floating Action Bar:** Instant summary of selected files, total estimated pages, and one-tap dispatch buttons.
- **Batch Download:** One-click "Download All" saves files directly into your device's public `Downloads/PrintReady` folder.

### 3. In-App Document Viewer & Native System Previews
- **Interactive Preview Modal:** High-resolution image viewers and document spec cards directly inside the application.
- **Native Android System Launcher:** Launches files using `ACTION_VIEW` so PDFs, Word docs, and photos open seamlessly in Google Drive PDF Viewer, Adobe Acrobat, Gallery, or Microsoft Word.
- **Scoped Storage Saving:** Built-in integration with Android `MediaStore.Downloads` for saving files cleanly without requiring intrusive storage permissions.

### 4. Document Scanner & Client-Side PDF Utilities
- **Camera Scanner:**
  - High-res scanning via native camera hardware intent (`capture="environment"`) or live webcam stream.
  - Multi-page reordering, rotation, brightness/contrast adjustments, and color filters (Crisp B&W, Grayscale, Color).
  - Searchable OCR indexing and AI summarization powered by Gemini.
- **PDF Utilities (`pdf-lib`):**
  - **Merge Multiple PDFs:** Combine multiple PDF documents into a single file with reordering, removal controls, and quick-selection from your existing queue or vault.
  - **Split & Page Range:** Extract specific pages (e.g., `1-3, 5`) into a new PDF.
  - **Rotate Pages:** Correct orientation (90°, 180°, 270°).
  - **Watermarking & Page Numbers:** Apply custom diagonal watermarks (e.g., `CONFIDENTIAL`, `DRAFT`) and stamp footer page numbers (`Page X of Y`).
  - Output files automatically save to your IndexedDB vault and appear immediately in the Print Queue.

### 5. Universal Accidental Deletion Protection
- **Safety Warnings Everywhere:** Confirmation dialogs protect against accidental clicks across all destruction actions:
  - Individual file removals from Print Queue & Print Basket
  - "Clear Queue" actions
  - Saved shop deletions
  - Sent order history clearance
  - Document Vault "Move to Trash" and "Delete Forever"
  - Custom print preset deletions
  - Scanned page removals

### 6. Saved Print Shops Directory & Discovery
- **Saved Directory:** Bookmark neighborhood photocopy shops, university xerox centers, and commercial printers with their WhatsApp number, email, phone, and address.
- **Default Shop:** Set a primary shop to automatically target orders and dispatches.
- **Interactive Shop Discovery:** Explore verified local print shops on an interactive map or filterable list.

### 7. Private Document Vault & Cloud Sync
- **Local-First IndexedDB:** Document binaries stay private on the device in local IndexedDB storage (`fileStorage.ts`).
- **Organization:** Categorization, custom folders, duplicate detection (exact checksum matching and versioning), and 30-day trash lifecycle.
- **Cloud Backup:** Optional Google Sign-In with Firebase Authentication and Cloud Firestore for synchronizing metadata across devices.

### 8. Print Shop Portal & Admin Console
- **Shop Operator Dashboard:** Live incoming orders queue, printer fleet status, consumable inventory alerts (paper reams, toner cartridges), and revenue analytics.
- **Admin Console:** Shop verification queue, order dispute resolution, platform settings, and audit logs.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, `pdf-lib` |
| **Android Native** | Capacitor 8, Native Java Plugins (`NativeSharePlugin.java`), `FileProvider`, `MediaStore.Downloads`, Android API 34 |
| **Backend API** | Node.js, Express (`server.ts`), TSX |
| **Storage & Database** | IndexedDB (Client binary storage), Cloud Firestore, Firebase Authentication |
| **AI Intelligence** | Google Gemini (`@google/genai` / `gemini-4-hydrogen`) for document classification and OCR |
| **Testing** | Node test runner (`node:test`, `npm test`) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Android Studio** & **JDK 17** (for compiling Android APKs)

### Web Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adityasing9/PrintReady.git
   cd PrintReady
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run unit tests:**
   ```bash
   npm test
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🤖 Building the Android Native APK

PrintReady uses Capacitor 8 with custom native Android bridges.

1. **Build the production web assets:**
   ```bash
   npm run build
   ```

2. **Sync web assets to the Android platform:**
   ```bash
   npx cap copy android
   ```

3. **Compile the release APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

The compiled, signed release APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🔒 Security & Privacy

- **Google Play Protect Compliant:** Complies with Android 14/15 policies with zero dangerous permissions (no `REQUEST_INSTALL_PACKAGES` or broad filesystem scanners).
- **Scoped Storage:** Files are saved exclusively using Android's modern `MediaStore.Downloads` API into the user-accessible `Downloads/PrintReady/` directory.
- **Private Local Vault:** Document binary data is stored locally in client-side IndexedDB and never uploaded to third-party cloud servers without user authorization.
- **Granular Security Rules:** Firestore security rules (`firestore.rules`) strictly enforce user isolation and administrative role verification.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
