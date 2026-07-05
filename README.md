# Popown – YouTube AI Companion

Asisten AI berbasis transkrip video + LLM yang berjalan langsung di browser Google Chrome. Popown memungkinkan pengguna melakukan tanya jawab instan tentang isi video YouTube, mendapatkan rangkuman eksekutif, dan melacak mention produk/brand — tanpa perlu meninggalkan halaman YouTube.

Proyek ini terdiri dari tiga komponen utama: **backend API (FastAPI)**, **ekstensi Chrome (Manifest V3)**, dan **web landing page interaktif (React + Vite + TypeScript)**.

---

## 📁 Struktur Repositori

```
popown/
├── backend/                  # FastAPI REST API Backend
│   ├── main.py               # Entry point server & konfigurasi CORS
│   ├── routers/              # Router endpoint (chat, brand, summarize)
│   ├── utils/                # Utilitas transcript & helper
│   ├── config.py             # Konfigurasi environment (.env loader)
│   ├── requirements.txt      # Dependensi Python
│   └── vercel.json           # Konfigurasi deployment Vercel
│
└── frontend/
    ├── landing/              # Web Landing Page (React + Vite + TypeScript)
    │   ├── src/
    │   │   ├── components/   # Komponen UI: Navbar, Hero, Features, dll.
    │   │   ├── types/        # TypeScript types global
    │   │   └── index.css     # Design system & global styling
    │   ├── public/           # Aset statis (termasuk popown-extension.zip)
    │   └── package.json
    │
    └── extension/            # Ekstensi Browser Google Chrome (Manifest V3)
        ├── manifest.json     # Konfigurasi ekstensi
        ├── popup.html        # UI popup ekstensi
        ├── popup.js          # Logika pemanggilan API & manipulasi YouTube
        ├── popup.css         # Styling popup ekstensi
        └── content.js        # Script injeksi untuk kontrol video YouTube
```

---

## 🛠️ Panduan Set Up & Menjalankan Lokal

### 1. Backend FastAPI

1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```
2. Buat virtual environment dan aktifkan:
   - **Windows (PowerShell)**:
     ```powershell
     py -m venv venv
     .\venv\Scripts\activate 
     ```
   - **Linux/macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Instal dependensi:
   ```bash
   pip install -r requirements.txt
   ```
4. Salin file konfigurasi env:
   ```bash
   cp .env.example .env
   ```
5. Isi variabel di dalam `.env`:
   ```
   OLLAMA_BASE_URL=https://...    # URL endpoint Ollama/LLM Anda
   OLLAMA_API_KEY=...             # API Key Anda
   OLLAMA_MODEL=gpt-oss:120b     # Nama model yang digunakan
   ```
6. Jalankan server lokal:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   *(Server berjalan di `http://localhost:8000`)*

---

### 2. Web Landing Page (React + Vite + TypeScript)

1. Masuk ke folder landing:
   ```bash
   cd frontend/landing
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
   *(Akses di `http://localhost:5173`)*

> **Catatan:** Untuk mengaktifkan tombol unduh ekstensi di landing page, kompres folder `frontend/extension/` menjadi file bernama `popown-extension.zip` dan letakkan di `frontend/landing/public/`. File ini akan otomatis tersedia di URL `/popown-extension.zip`.

---

### 3. Ekstensi Google Chrome

#### Untuk Pengguna Umum (Rekomendasi)
1. Unduh `popown-extension.zip` dari tombol **Unduh / Instal Ekstensi** di website landing page.
2. Ekstrak file ZIP ke sebuah folder baru di komputer Anda.
3. Buka `chrome://extensions` di Google Chrome.
4. Aktifkan **"Developer mode"** di pojok kanan atas.
5. Klik **"Load unpacked"** dan pilih folder hasil ekstrak (yang berisi `manifest.json`).

#### Untuk Developer
1. Buka `chrome://extensions` di Google Chrome.
2. Aktifkan **"Developer mode"** di pojok kanan atas.
3. Klik **"Load unpacked"** dan pilih folder `frontend/extension/` dari repositori.

Ekstensi siap! Buka YouTube, klik ikon ekstensi Popown, dan pin ke toolbar agar selalu mudah diakses.

---

## 🚀 Deployment ke Vercel

### A. Deploy Backend (FastAPI)

1. Hubungkan repositori ke akun Vercel dan buat project baru.
2. Set **Root Directory** ke `backend`.
3. Di **Environment Variables**, tambahkan:
   - `OLLAMA_BASE_URL`
   - `OLLAMA_API_KEY`
   - `OLLAMA_MODEL`
4. Klik **Deploy**. Simpan URL backend yang dihasilkan (contoh: `https://popown-backend.vercel.app`).

### B. Deploy Frontend Landing Page (React Vite)

1. Buat project baru di Vercel dengan **Root Directory** `frontend/landing`.
2. Vercel otomatis mendeteksi preset **Vite** dan menggunakan `npm run build` dengan output folder `dist`.
3. Di **Environment Variables**, tambahkan:
   - `VITE_API_URL` = URL backend dari langkah A.
4. Klik **Deploy**. Pastikan file `popown-extension.zip` sudah ada di folder `public/` sebelum build.

---

## 🔗 Referensi API (Backend)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/chat` | POST | Chat tentang video, navigasi waktu (`ke menit 3`), pencarian adegan |
| `/api/brand` | POST | Deteksi brand/merek yang disebutkan dalam video beserta timestamp |
| `/api/summarize` | POST | Rangkuman eksekutif video dalam format Markdown |
| `/health` | GET | Health check server |

### Contoh Request `/api/chat`
```json
{
  "video_id": "xlWhpXdOlTo",
  "message": "Kapan KFC dibahas?",
  "language": "id"
}
```

### Contoh Response `/api/chat`
```json
{
  "reply": "KFC dibahas sekitar menit 3:00 ketika presenter mengunjungi gerai pertama.",
  "jump_to_seconds": 180.0
}
```
