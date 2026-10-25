# Arsitektur AI Workspace

Dokumen desain utama: [Desain Produk dan Arsitektur Awal](ai-artifacts/plans/2026-10-25-ai-workspace-design.md).

## Konsep

Aplikasi desktop Linux dan Windows dengan terminal Pi asli sebagai area kerja utama, sidebar untuk mengelola sesi, serta layout terminal yang dapat diubah. Saat startup normal, satu sesi Pi langsung berjalan.

Hybrid berarti terminal asli + UI pengelolaan workspace; UI chat native dan kontrol RPC/SDK belum menjadi bagian wajib MVP.

## Stack sementara

| Komponen | Teknologi |
| --- | --- |
| Desktop | Electron + TypeScript |
| Frontend | React + Vite + Tailwind CSS |
| Terminal UI | xterm.js |
| Terminal process | node-pty |
| AI engine | Pi Coding Agent |
| Integrasi terstruktur lanjutan | Pi RPC / SDK, perlu verifikasi |
| Penyimpanan | SQLite, kebutuhan MVP belum diputuskan |
| Packaging | electron-builder |

## Batas arsitektur

- React mengatur sidebar, panel, fokus, dan layout.
- Preload menyediakan API IPC terbatas.
- Backend Electron mengelola workspace, sesi, dan proses PTY.
- Tiap sesi Pi diusulkan memiliki PTY/proses terpisah.
- Layout terpisah dari lifecycle sesi: panel tersembunyi tidak berarti proses berhenti.
- Pemulihan UI, resume percakapan Pi, dan mempertahankan proses hidup adalah kebutuhan berbeda.

Status: dokumentasi awal; belum implementasi. Detail, pertanyaan terbuka, dan strategi verifikasi tersedia dalam dokumen desain utama.
