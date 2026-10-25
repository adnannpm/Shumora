# Shumora — Desain Produk dan Arsitektur Awal

Tanggal: 2026-10-25
Status: arah produk disepakati dalam diskusi; detail teknis masih berupa rancangan, belum implementasi.

## 1. Tujuan

Membuat aplikasi desktop Linux dan Windows untuk menjalankan dan mengelola banyak sesi Pi Coding Agent dalam satu workspace. Aplikasi berfokus pada pengelolaan sesi dan tampilan, bukan membangun ulang agentic engine.

Inspirasi:
- Pi Coding Agent: pengalaman kerja AI di terminal.
- VS Code: sidebar, workspace, dan navigasi sesi.
- tmux: beberapa terminal dan split view.
- AI Session Manager: pengelolaan sesi secara terpusat.

## 2. Arah yang Disepakati

- Pengalaman hybrid: terminal Pi asli menjadi area kerja utama, dilengkapi UI desktop untuk pengelolaan sesi dan layout.
- Saat aplikasi dibuka, tampil satu terminal dengan Pi yang sudah berjalan, dengan prasyarat runtime dan direktori kerja tersedia.
- Sidebar menyediakan daftar sesi dan aksi menambahkan sesi.
- Pengguna bisa mengubah susunan tampilan terminal.
- Pengembangan saat ini berhenti pada dokumentasi; belum ada persetujuan memulai implementasi.

Hybrid di sini berarti **terminal asli + UI pengelolaan**, bukan janji bahwa satu sesi bisa berganti secara langsung antara terminal Pi dan chat React. UI chat terstruktur belum menjadi kebutuhan yang disepakati.

## 3. Model Interaksi

### Tampilan awal

```text
┌──────────────────┬─────────────────────────────────────┐
│ WORKSPACE        │ Pi — Session 1                      │
│                  ├─────────────────────────────────────┤
│ ＋ Sesi          │                                     │
│                  │ Terminal Pi                         │
│ ● Session 1      │                                     │
│                  │ > Masukkan prompt...                │
└──────────────────┴─────────────────────────────────────┘
```

### Contoh split view

```text
┌──────────────────┬──────────────────┬──────────────────┐
│ WORKSPACE        │ Session 1        │ Session 2        │
│                  │ Terminal Pi      │ Terminal Pi      │
│ ＋ Sesi          │                  │                  │
│                  ├──────────────────┴──────────────────┤
│ ● Session 1      │ Session 3                            │
│ ● Session 2      │ Terminal Pi                          │
│ ● Session 3      │                                      │
└──────────────────┴─────────────────────────────────────┘
```

### Rancangan perilaku

- Sidebar memilih sesi yang ditampilkan atau difokuskan.
- Menambah sesi membuat sesi baru; pilihan Pi saja atau juga shell biasa belum diputuskan.
- Sesi dan layout adalah konsep terpisah: menyembunyikan panel atau mengganti layout tidak seharusnya menghentikan proses sesi.
- Aksi menutup panel perlu dibedakan dari menghentikan sesi.
- Penanganan penutupan aplikasi ketika proses masih bekerja perlu dikonfirmasi sebelum implementasi.

### Kandidat layout awal

1. Single: satu sesi memenuhi area utama.
2. Split vertikal: dua panel berdampingan.
3. Split horizontal: dua panel atas–bawah.
4. Grid: empat panel.
5. Ukuran panel dapat disesuaikan.

Preset ini adalah usulan awal, belum spesifikasi final. Freeform docking seperti VS Code ditunda untuk menjaga cakupan.

## 4. Stack Sementara

| Komponen | Pilihan | Catatan |
| --- | --- | --- |
| Bahasa | TypeScript | Frontend dan backend desktop |
| Desktop | Electron | Integrasi ekosistem Node.js |
| Frontend | React + Vite | UI workspace |
| Styling | Tailwind CSS | Tampilan aplikasi |
| Terminal emulator | xterm.js | Menampilkan terminal di renderer |
| Terminal backend | node-pty | Menjalankan proses terminal |
| AI engine | Pi Coding Agent | Menangani loop agent, tools, model, dan konteks |
| Integrasi terstruktur | Pi RPC / SDK | Kandidat tahap lanjutan; kemampuan dan batas perlu diverifikasi |
| Penyimpanan | SQLite | Kandidat metadata aplikasi; belum wajib untuk prototipe |
| Packaging | electron-builder | Kandidat distribusi Linux dan Windows |

Pemilihan ini belum membuktikan kompatibilitas versi, native module, atau packaging lintas OS. Validasi diperlukan sebelum implementasi.

## 5. Arsitektur yang Diusulkan

```text
Electron Application
│
├── Renderer: React
│   ├── Sidebar / Session List
│   ├── Workspace Layout / Panels
│   ├── Terminal Views: xterm.js
│   └── Settings UI (tahap lanjutan)
│
├── Preload: API IPC terbatas
│
└── Main Process / Backend Services
    ├── Workspace Manager
    ├── Session Manager
    ├── PTY Manager: node-pty
    │   ├── PTY → Pi Session A
    │   ├── PTY → Pi Session B
    │   └── PTY → Pi Session C
    ├── Persistence Adapter
    └── Pi Structured Integration (opsional, tahap lanjutan)
```

Satu PTY/proses Pi per sesi adalah usulan isolasi awal. Lokasi pasti layanan PTY, termasuk kemungkinan utility process untuk isolasi, perlu ditetapkan setelah validasi teknis.

### Tanggung jawab

- **Renderer:** render terminal, input pengguna, navigasi, fokus, dan layout. Tidak mendapat akses Node.js langsung.
- **Preload:** mengekspos API terbatas untuk membuat sesi, mengirim input, resize, menerima output, dan menghentikan sesi.
- **Session Manager:** identitas sesi, metadata, lifecycle, serta hubungan sesi dengan proses.
- **PTY Manager:** spawn, input/output, resize, exit, dan pembersihan resource.
- **Workspace Manager:** direktori kerja, daftar sesi, sesi aktif, dan layout.
- **Persistence Adapter:** menyimpan metadata milik aplikasi tanpa mengambil alih format riwayat Pi.
- **Pi runtime:** menjalankan perilaku AI dan tools. Aplikasi tidak membangun ulang agent loop.

### Alur terminal

```text
Keyboard → xterm.js → preload/IPC → PTY → Pi
Pi → PTY output → IPC → xterm.js
Panel resize → ukuran kolom/baris → IPC → PTY resize
```

Output terminal bukan API semantik agent. Jangan mengandalkan parsing teks terminal untuk status seperti "AI sedang berpikir" atau "tool sedang berjalan". Status tersebut membutuhkan integrasi terstruktur yang tervalidasi.

## 6. Konsep Data dan Lifecycle

### Workspace

Identitas, nama, direktori kerja, daftar sesi, sesi aktif, dan konfigurasi layout. Dukungan banyak workspace sekaligus belum diputuskan.

### Session

Identitas aplikasi, nama, direktori kerja, jenis sesi bila diperlukan, status proses, referensi proses saat hidup, dan referensi sesi Pi bila tersedia melalui mekanisme yang didukung.

Status proses awal yang diusulkan: `starting`, `running`, `exited`, `error`. `running` hanya berarti proses hidup, bukan AI sedang mengerjakan tugas.

### Layout

Pemetaan panel ke sesi, jenis susunan, ukuran panel, dan panel aktif. Layout tidak memiliki lifecycle proses.

### Tiga arti persistence yang harus dibedakan

1. **Pemulihan UI:** mengembalikan daftar sesi, direktori, dan layout.
2. **Melanjutkan percakapan Pi:** membuka kembali konteks melalui fasilitas persistence/resume Pi yang perlu diverifikasi.
3. **Mempertahankan proses hidup setelah aplikasi keluar:** membutuhkan mekanisme tambahan dan bukan janji MVP.

Menyimpan metadata SQLite tidak otomatis memberikan ketiga kemampuan ini. Hindari menyimpan riwayat percakapan Pi ganda tanpa alasan jelas.

## 7. Cakupan Bertahap

### Tahap 1 — MVP Workspace Terminal

Target kandidat:
- Aplikasi desktop dengan sidebar dan area terminal.
- Satu sesi Pi otomatis saat startup normal.
- Menambah dan memilih beberapa sesi independen.
- Mengalirkan input/output terminal dan resize dengan benar.
- Mengganti tampilan tanpa mematikan sesi tersembunyi.
- Kontrol menghentikan sesi dan penanganan exit/error.
- Layout single dan split dasar; grid serta persistensi dapat diprioritaskan setelah scope dikonfirmasi.

### Tahap 2 — AI Management

Kandidat: pengaturan model/provider, prompt library, riwayat sesi, pemulihan workspace, dan integrasi Pi terstruktur jika dibutuhkan.

### Tahap 3 — Advanced Workspace

Kandidat: layout lebih fleksibel, pemantauan banyak agent, serta komunikasi atau koordinasi antarsesi. Independensi sesi adalah baseline; komunikasi tidak diasumsikan tersedia.

### Bukan cakupan awal

- Membangun agent engine sendiri.
- Mengganti seluruh TUI Pi dengan UI chat React.
- Orkestrasi multi-agent otomatis.
- Freeform docking penuh.
- Jaminan proses terus hidup setelah aplikasi ditutup.

## 8. Keamanan dan Failure Behavior

Rancangan yang perlu diterapkan dan diuji:
- Gunakan renderer terisolasi, context isolation, serta IPC terbatas dan tervalidasi; jangan aktifkan akses Node.js bebas di renderer.
- Validasi identitas sesi dan ukuran/input pesan IPC.
- Jangan memasukkan API key ke metadata UI atau log terminal aplikasi secara sengaja; mekanisme kredensial Pi perlu dikaji.
- Jangan merakit shell command dari input tak tepercaya; pilih executable dan argumen secara aman.
- Jika Pi tidak ditemukan, tampilkan penjelasan dan jalur konfigurasi/instalasi, bukan terminal kosong tanpa informasi.
- Jika direktori kerja belum tersedia, minta pengguna memilihnya sebelum spawn.
- Jika proses gagal atau keluar, tandai sesi dan tawarkan restart; jangan restart tanpa batas.
- Penutupan sesi/aplikasi harus memiliki kebijakan jelas agar pekerjaan aktif tidak terhenti diam-diam dan tidak meninggalkan proses yatim.

## 9. Alternatif dan Trade-off

- **Native chat UI sejak awal:** tidak dipilih untuk tahap awal karena kebutuhan utama adalah terminal Pi asli, dan rendering interaksi agent akan menambah cakupan.
- **Terminal wrapper tanpa UI workspace:** terlalu terbatas untuk kebutuhan sidebar, multi-sesi, dan pengaturan layout.
- **Tauri:** alternatif yang dipertimbangkan, tetapi Electron dipilih sementara untuk kedekatan dengan Node.js/TypeScript; ini bukan klaim bahwa Tauri tidak dapat mendukung proyek.
- **RPC/SDK sejak awal untuk semua sesi:** belum dipilih. Integrasi terminal dan integrasi terstruktur memiliki konsekuensi berbeda; jangan mengasumsikan keduanya dapat mengontrol sesi yang sama tanpa dukungan eksplisit.

## 10. Pertanyaan Terbuka

1. Tombol tambah sesi hanya membuat Pi, atau juga menawarkan shell biasa?
2. Bagaimana direktori kerja pertama dipilih dan diingat?
3. Apakah sesi baru memakai direktori yang sama atau dapat memilih folder sendiri?
4. Preset layout mana yang wajib masuk MVP?
5. Apakah tab diperlukan selain navigasi sidebar?
6. Apa perilaku menutup panel, menghentikan sesi, dan menutup aplikasi?
7. Apakah persistence MVP hanya memulihkan UI atau juga percakapan Pi?
8. Pi memakai instalasi sistem, dibundel, atau dikelola aplikasi?
9. Bagaimana runtime, shell, native module node-pty, dan packaging diverifikasi di Windows serta Linux?
10. Kemampuan RPC/SDK mana yang benar-benar dibutuhkan untuk pengelolaan model dan status agent?
11. Apakah aplikasi membutuhkan SQLite sejak MVP atau cukup penyimpanan konfigurasi sederhana?

## 11. Strategi Verifikasi

Sebelum mengunci implementasi, periksa dokumentasi Pi dan buat spike teknis minimal untuk PTY, terminal rendering, serta distribusi lintas OS.

Kriteria penerimaan kandidat:
- Dengan Pi terpasang dan direktori valid, startup menampilkan satu sesi Pi interaktif.
- Beberapa sesi tidak saling mencampur input/output.
- Mengganti fokus/layout tidak memulai ulang atau menghentikan proses.
- Resize panel memperbarui ukuran PTY dan TUI tetap dapat digunakan.
- Shortcut terminal, paste, Unicode, dan scroll bekerja pada OS target.
- Exit proses dan kegagalan spawn terlihat jelas dan tidak merusak sesi lain.
- Menghentikan sesi membersihkan proses serta listener sesuai kebijakan lifecycle.
- Jika persistence masuk scope, restart memulihkan hal yang dijanjikan secara eksplisit, tanpa mengklaim proses lama masih hidup.
- Build terpaket diuji di Linux dan Windows, bukan hanya melalui development server.

## 12. Langkah Berikutnya

Tinjau dokumen ini bersama pengguna, selesaikan pertanyaan produk utama, lalu tentukan scope MVP dan rencana implementasi. Dokumen ini tidak memberikan otorisasi untuk mulai coding.
