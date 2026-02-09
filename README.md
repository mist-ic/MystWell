# MystWell - Personal Health & Wellness Companion 🏥

<div align="center">

[![Expo](https://img.shields.io/badge/Expo-52-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Azure](https://img.shields.io/badge/Azure-API-0078D4?style=for-the-badge&logo=microsoft-azure&logoColor=white)](https://azure.microsoft.com/)

<br />

> **A comprehensive mobile health app for medication management, medical document scanning, and AI-powered voice notes.**

> ⚠️ **This project has been shelved.** MystWell was a startup experiment that helped me learn production-grade mobile + backend development. Something bigger and better is in the works, stay tuned. 🚀

</div>

---

## ✨ Key Features

### 💊 Smart Medication Management
- **Drug Search** - Integrated with **RxNorm API** (NIH's drug database) for accurate medication lookup
- **Approximate Matching** - Fuzzy search finds drugs even with misspellings
- **Drug Details** - View dosage forms, strengths, brand names, NDC codes, and DEA schedules
- **Reminders** - Schedule medication reminders with push notifications

### 📄 Medical Document Scanner
- **Document Scanning** - Scan prescriptions, lab reports, and medical records using device camera
- **Document Organization** - Store and categorize all medical documents in one place
- **43KB DocumentDetails** - Rich document viewer with metadata and annotations

### 🎙️ AI Voice Recording
- **Medical Notes** - Record voice notes during doctor visits
- **Gemini Transcription** - Azure-hosted API with Google Gemini for accurate transcription
- **Audio Waveform** - Visual feedback during recording
- **Retry Failed Transcriptions** - Robust error handling for transcription failures

### 🛒 Medicine Ordering
- Browse vendors and reorder medications
- Cart management and checkout flow
- Order history and tracking

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | Expo SDK 52, React Native 0.76 |
| **Language** | TypeScript 5.8 |
| **Navigation** | Expo Router (file-based routing) |
| **Auth & DB** | Supabase |
| **Backend API** | Azure Web App (Python/FastAPI) |
| **AI Services** | Google Gemini (transcription analysis) |
| **Drug Data** | RxNorm REST API (NIH) |
| **UI Components** | React Native Paper, RNEUI |
| **Notifications** | Expo Notifications |

---

## 📁 Project Structure

```
MystWell/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── medicine/          # Medicine ordering flow
│   └── recording/         # Voice recording screens
├── components/            # Reusable UI components
│   ├── DocumentDetails.tsx   # Medical document viewer
│   ├── AudioWaveform.tsx     # Recording visualizer
│   └── RecordingSummary.tsx  # Transcription display
├── services/              # API integrations
│   ├── medicineService.ts    # RxNorm API (377 lines)
│   ├── recordingService.ts   # Azure API (227 lines)
│   └── chatService.ts        # Chat functionality
├── context/               # React context providers
├── hooks/                 # Custom React hooks
└── utils/                 # Error handling, helpers
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio / Xcode (for native builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/mist-ic/MystWell.git
cd MystWell

# Install dependencies
npm install

# Start development server
npx expo start
```

### Running on Device

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios

# Web
npx expo start --web
```

---

## 🔌 API Integrations

### RxNorm (NIH Drug Database)
- `searchDrugsByName()` - Exact name matching
- `searchDrugsApproximate()` - Fuzzy search with scoring
- `getDrugDetailsByRxcui()` - Full drug properties

### Azure Backend
- `getRecordingById()` - Fetch recording with transcription
- `deleteRecording()` - Remove recording
- `retryTranscription()` - Retry failed Gemini analysis

---

## 📱 Screenshots

| Home | Medicine Search | Recording |
|------|-----------------|-----------|
| *Coming soon* | *Coming soon* | *Coming soon* |

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ by mist-ic</sub>
</div>
