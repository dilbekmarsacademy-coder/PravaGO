# Admin panel — reja

Admin panel o'zimizniki: Next.js `/admin/*` sahifalari + NestJS `/admin/*` endpointlari. Tayyor admin vositalari ishlatilmaydi.

## Arxitektura

- **Kirish oqimi.** Brauzer → Next.js `/admin/api/*` (route handler, proxy) → backend `/admin/*`.
  - Admin cookie frontend domenida turadi: `__Host-pt_admin`, httpOnly, Secure, SameSite=Strict, 12 soat. Qiymati — HMAC bilan imzolangan sessiya tokeni.
  - Backend tokenni `AdminSession` jadvalida tekshiradi (sha256 xeshi). Shu sababli sessiyani bekor qilish mumkin.
  - Backend va frontend turli saytlarda (`*.vercel.app` public suffix). Shuning uchun SameSite=Strict cookie faqat shu sxemada ishlaydi.
- **Proxy kaliti.** Next.js backend'ga `X-Admin-Proxy-Key` = HMAC(`ADMIN_SESSION_SECRET`, "admin-proxy-v1") yuboradi. Admin API'ni brauzerdan to'g'ridan-to'g'ri chaqirib bo'lmaydi. Mijoz IP'si ham faqat shu kalit bilan qabul qilinadi.
- **CSRF.** SameSite=Strict, `Origin` tekshiruvi va double-submit token (`pt_admin_csrf` cookie + `x-csrf-token` header).
- **Next.js proxy.ts.** Barcha `/admin` sahifalari imzoli cookie'ni tekshiradi, javobga `X-Robots-Tag: noindex` qo'shadi. `robots.txt`da `/admin` yopiq.
- **Login rate limit.** Bazada saqlanadi (serverless instance'lar orasida umumiy). 15 daqiqada 5 ta muvaffaqiyatsiz urinish, IP va login bo'yicha alohida. Har bir urinish `AdminLoginAttempt`ga yoziladi.
- **Rollar.** `OWNER | DEVELOPER`, `@AdminRoles()` dekoratori. Hozircha ikkala rol ham hamma narsaga ruxsatli (`ADMIN_PERMISSIONS`).
- **Audit.** `AuditLog`: admin, amal, obyekt, eski/yangi qiymat, IP, vaqt. Admin panelda "Tarix" sahifasi bor.

## Bosqichlar

1. Admin jadvallari, login/logout/parol o'zgartirish, guard, audit, `admin:create` / `admin:reset-password` skriptlari.
2. User profili: ism, familiya, telefon (+998…, unikal), ro'yxatdan o'tish sanasi, oxirgi faollik, to'lov holati.
   - Ro'yxatdan o'tish formasi backend'ga yuboriladi. Avval localStorage'da ro'yxatdan o'tganlar backend'ga jim ko'chiriladi.
   - `Payment` jadvali: /tolov → "kutilmoqda", admin tasdiqlaydi. Kurs kontentiga kirish `AccessService`da tekshiriladi (`PAYMENT_ENFORCED`).
   - Admin sahifalari: users, users/[id], payments, CSV eksport.
3. /admin/content: kun → mavzu → savol tahriri, kalit so'z belgilash komponenti, needsReview filtri. Ochiq kunlar — `ADMIN_EDITABLE_DAYS`.
4. "Yangi testlar": `Topic.kind = "collection"`, nashr/qoralama, tartib.
   - Savol qo'shish formasi; transliteratsiya va AI tarjima; dublikat ogohlantiruvi; yumshoq o'chirish.
   - Rasm `MediaAsset` jadvalida saqlanadi (asl nusxa yopiq, tasdiqlangani `/media/:id.webp`). Ishlov `ImageJob` orqali beriladi: Claude vision → OpenCV inpaint → sharp trim → WebP 1280/80. Fonni kesish alohida tugma bilan.
5. `AnalyticsEvent` (batch, shaxsiy ma'lumotsiz), `AnswerLog`, /admin/dashboard, AI tahlil (`AiReport`), haftalik cron.

## Migratsiyalar

Barcha o'zgarishlar qo'shimcha (yangi jadval / nullable ustun). Joriy production kodi yangi sxema bilan ham ishlayveradi. Har migratsiyaning orqaga qaytarish SQL'i `backend/prisma/down/` papkasida.

## Eskiz (telefon OTP) bilan moslik

User'dagi ustunlar Eskiz branch'i bilan bir xil nomda: `phone` (unikal), `firstName`, `lastName`, `age`, `examStatus`, `phoneVerifiedAt`. Telefon `+998XXXXXXXXX` formatida.

Birlashtirishda Eskiz branch'idagi User ustunlari migratsiyasi olib tashlanadi. `normalizePhone` esa `+` bilan qaytaradigan qilinadi.
