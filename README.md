# Pi Workspace — MVP

Desktop workspace untuk banyak terminal Pi Coding Agent. Terminal Pi asli ditampilkan dengan xterm.js; Electron mengelola satu PTY per sesi. Tidak perlu clone source Pi.

## Fitur

- Startup membuat satu sesi Pi di folder home.
- Sidebar menambah dan memilih sesi independen (maksimal 32 per aplikasi).
- Single view dan split dua kolom; memilih sesi lain mengganti pasangan split, klik panel untuk fokus.
- Sesi tersembunyi tetap hidup. Mengganti layout tidak membuat ulang proses.
- Pemilih folder untuk **sesi berikutnya**; sesi yang sudah berjalan tidak berpindah direktori.
- Stop/restart per sesi, status proses, pesan kegagalan launch.
- Konfirmasi sebelum menutup aplikasi ketika masih ada proses hidup.

## Prasyarat

- Node.js 22.19+ (disarankan versi LTS yang didukung dependency), npm.
- Pi sudah terinstal dan dapat dijalankan lewat `pi`; konfigurasi/login provider dilakukan di Pi.
- Desktop Linux atau Windows. Linux memerlukan library sistem Electron dan dukungan sandbox yang sesuai distribusi.
- Native module `node-pty` dibangun untuk Electron saat postinstall. Jika tidak ada prebuild: Linux membutuhkan compiler C/C++/make/Python; Windows membutuhkan toolchain native yang sesuai node-gyp, biasanya Visual Studio Build Tools dan Python.

## Development

```bash
npm install
npm run dev
```

Buka folder proyek ini di terminal sebelum menjalankan perintah. Aplikasi awalnya menggunakan folder home, bukan folder source aplikasi, sebagai direktori sesi Pi.

Jika Pi tidak ditemukan pada PATH aplikasi desktop:

```bash
PI_EXECUTABLE=/absolute/path/to/pi npm run dev
```

Windows PowerShell:

```powershell
$env:PI_EXECUTABLE = 'C:\path\to\pi.exe'
npm run dev
```

Launcher Windows mendukung executable `.exe` atau instalasi npm standar dengan `pi.cmd` dan `node.exe` pada PATH. Untuk instalasi nonstandar yang menggunakan shim:

```powershell
$env:PI_NODE_EXECUTABLE = 'C:\Program Files\nodejs\node.exe'
$env:PI_CLI_PATH = 'C:\path\to\node_modules\@earendil-works\pi-coding-agent\dist\cli.js'
$env:PI_EXECUTABLE = 'C:\path\to\pi.cmd'
npm run dev
```

Shim tidak dieksekusi lewat interpolasi `cmd.exe`. Pi tidak dibundel dan aplikasi tidak menginstalnya otomatis. Environment konfigurasi harus tersedia saat aplikasi diluncurkan; launcher dari menu desktop mungkin memiliki PATH berbeda dari terminal.

## Verifikasi

```bash
npm test
npm run typecheck
npm run build
node scripts/smoke.mjs
```

Status verifikasi aktual dan keterbatasannya dicatat di [laporan verifikasi](ai-artifacts/verification/2026-10-25-mvp-verification.md). Unit/UI tests dan build lolos; smoke test desktop saat ini masih timeout pada koneksi DevTools di lingkungan pengembangan.

Smoke test membutuhkan display desktop, binary Electron tersedia, dan Pi terinstal. Test ini membuka aplikasi, memeriksa output Pi, renderer isolation, penambahan sesi, split/single, keberlangsungan proses tersembunyi, dan stop. Tidak mengirim prompt berbayar ke model. Playwright dapat menonaktifkan sandbox dalam proses test; konfigurasi aplikasi normal tetap sandboxed.

## Build dan packaging

```bash
npm run build
npm run pack
npm run dist
```

Output build berada di `out/`, packaging di `release/`. Konfigurasi target awal: Linux AppImage dan Windows NSIS. Build rilis perlu dijalankan/diuji pada OS target agar native module sesuai. Code signing, installer polish, dan update otomatis belum disiapkan. Jangan menganggap konfigurasi packaging berarti kedua platform sudah terverifikasi.

## Lifecycle dan batas MVP

- Status `running` hanya berarti proses hidup, bukan model sedang berpikir.
- Stop/restart menghentikan proses; restart memulai proses Pi baru, **bukan resume percakapan**.
- Penutupan normal aplikasi menghentikan managed PTY. Tidak ada daemon/background session.
- Penghentian paksa aplikasi dan child process yang dibuat tool Pi belum dijamin seluruhnya bersih; jangan mengandalkan aplikasi sebagai process supervisor produksi.
- Tidak ada penyimpanan workspace/layout, prompt library, database, chat React, pengelolaan model/provider, atau komunikasi antar-agent.
- Pi memakai kredensial, extensions, tools, dan akses file milik pengguna. Renderer isolation bukan sandbox untuk pekerjaan agent.
- Output replay dibatasi 512.000 karakter per sesi; bukan arsip percakapan atau snapshot layar terminal yang sempurna.
- Split berukuran sama; drag-resize panel belum masuk versi ini.
- Windows runtime dan installer serta build terpaket Linux masih perlu uji native sebelum rilis.

## Struktur

```text
src/main/         Electron, lifecycle sesi, launcher Pi
src/preload/      API IPC terbatas
src/shared/       Kontrak tipe
src/renderer/     React workspace dan terminal
tests/            Unit dan UI regression tests
scripts/          Desktop smoke test
ai-artifacts/     Desain, rencana, dan bukti verifikasi
```

Desain: [ai-artifacts/plans/2026-10-25-ai-workspace-design.md](ai-artifacts/plans/2026-10-25-ai-workspace-design.md).
