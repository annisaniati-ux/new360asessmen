# Asesmen 360 — Pegadaian (Vercel deploy package)

Paket ini berisi versi situs yang sama seperti artifact Claude, tapi datanya disimpan
di **Upstash Redis** (lewat Vercel serverless function) supaya bisa jalan mandiri di
luar Claude.ai — cocok untuk deploy ke `asessmen360.vercel.app`.

## Isi folder
- `index.html` — seluruh aplikasi (form penilaian, admin panel, hasil, dst). Sama
  seperti versi Claude, hanya bagian penyimpanan datanya diganti supaya bicara ke
  `/api/kv` alih-alih `window.storage`.
- `api/kv.js` — serverless function yang menjembatani ke Upstash Redis lewat REST API.
- `package.json`, `vercel.json` — konfigurasi minimal, tidak perlu proses build apa pun.

## Cara deploy

### 1. Upload ke GitHub
Buat repo baru (atau pakai repo yang sudah terhubung ke project `asessmen360` di
Vercel), lalu push semua file di folder ini ke repo tersebut.

```bash
git init
git add .
git commit -m "Asesmen 360 - Vercel + Upstash"
git branch -M main
git remote add origin <URL_REPO_GITHUB_KAMU>
git push -u origin main
```

### 2. Sambungkan Upstash Redis (kalau belum)
Di dashboard Vercel project kamu:
1. Tab **Storage** → **Create Database** → pilih **Upstash** → **Redis**
2. Pilih plan **Free**, region terdekat, storage type **RAM only**
3. **Connect Project** → pilih project ini
4. Vercel otomatis menambahkan environment variable `UPSTASH_REDIS_REST_URL` dan
   `UPSTASH_REDIS_REST_TOKEN` (atau `KV_REST_API_URL` / `KV_REST_API_TOKEN` kalau
   lewat integrasi KV lama — `api/kv.js` sudah mendukung kedua-duanya).

### 3. Redeploy
Push otomatis trigger deploy baru, atau klik **Redeploy** manual di tab Deployments.

### 4. Cek
Buka situsnya — kalau pesan "Database belum tersambung" sudah hilang, berarti
sudah konek dan siap dipakai.

## Catatan
- Semua data (roster peserta, jawaban penilaian, hasil) disimpan sebagai key-value
  sederhana di Redis — tidak perlu bikin tabel apa pun.
- Kalau nanti mau ganti provider (misalnya ke Supabase/Postgres), yang perlu diubah
  cukup isi `api/kv.js` saja; `index.html` tidak perlu disentuh karena hanya bicara
  ke endpoint `/api/kv`.
  
