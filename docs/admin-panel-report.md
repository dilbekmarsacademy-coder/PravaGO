# Admin panel — hisobot (2026-10-28)

Sirlar bu faylda yo'q. Kirish ma'lumotlari repodan tashqarida: `~/pravatayyor-admin-kirish.txt` (600).

## 1. Nima qilindi

Barchasi o'zimizning kod: Next.js `/admin/*` + NestJS `/admin/*`. Tayyor admin vositalari ishlatilmagan.

**1-bosqich — kirish va xavfsizlik.**
- Kirish: maxsus kod + login + parol (argon2id).
- Sessiya: httpOnly / Secure / SameSite=Strict cookie, 12 soat. Cookie HMAC bilan imzolanadi, `AdminSession` jadvalida tekshiriladi va bekor qilinishi mumkin.
- Admin API faqat Next.js proxy orqali ishlaydi (`X-Admin-Proxy-Key`). CSRF himoyasi: Origin tekshiruvi + double-submit token.
- Login rate limit: 15 daqiqada 5 ta xato, IP va login bo'yicha alohida, bazada hisoblanadi. Barcha urinishlar logga yoziladi.
- Audit log va "Tarix" sahifasi.
- Rollar: OWNER / DEVELOPER (`ADMIN_PERMISSIONS`, hozircha ikkalasi ham to'liq).
- `/admin` noindex, `robots.txt`da yopiq.
- Skriptlar: `npm run admin:create`, `admin:reset-password`, `admin:hash-code`.

**2-bosqich — foydalanuvchilar va to'lovlar.**
- Ro'yxatdan o'tish backend'ga yoziladi (`POST /me/register`), telefon `+998…` ko'rinishida, unikal.
- Eski localStorage ro'yxati jim ko'chiriladi. Eski "faol" (mock to'lov) holati → "kutilmoqda" so'rovi.
- /tolov: qo'lda tasdiqlanadigan so'rov yuboriladi, sahifa holatni o'zi yangilab turadi.
- Kurs kontentiga (test, javob, kalit so'zlar, video ID, yangi testlar) kirish faqat backend'da tekshiriladi (`PAYMENT_ENFORCED=true`).
- Sahifalar: `/admin/users` (qidiruv, filtr, saralash, sahifalash, CSV), `/admin/users/[id]`, `/admin/payments`.

**3-bosqich — kontent.**
- `/admin/content` → kun → mavzu → savol. Ochiq kunlar: `ADMIN_EDITABLE_DAYS` (hozir `[6]`; env bilan ham o'zgartiriladi).
- Savol muharriri:
  - Kirill / Lotin / Rus tablari, 2–6 variant (qo'shish, o'chirish, tartib), aynan bitta to'g'ri javob, izoh, rasm.
  - Kalit so'z belgilash: sariq — savol kaliti, yashil — javob kaliti. Bir nechta bo'lak, "mavjud emas" holati.
  - Boshqa o'zbek yozuvi uchun transliteratsiya taklifi, admin tasdiqlaydi.
  - Jonli preview: telefon va kompyuter ko'rinishi.
- Filtrlar: tekshirilmagan / kalit so'zsiz / javobsiz. "Tekshirildi" tugmasi.
- Backend validatsiyasi va audit bor. API javoblari `Cache-Control: no-store` — o'zgarish saytda darhol ko'rinadi.

**4-bosqich — "Yangi testlar".**
- To'plamlar: 3 tilda nom, tartib, nashr / qoralama, yumshoq o'chirish.
- Savol qo'shish bosqichma-bosqich: rasm → matn → variantlar → javob → kalit so'z → izoh → ko'rib chiqish. Dublikat ogohlantiruvi bor. Ruscha matn AI bilan to'ldiriladi (`ruNeedsReview`).
- Kabinetda "Yangi testlar" bloki — faqat to'lov qilganlarga, faqat nashr qilinganlar.
- Rasm konveyeri (`ImageJob`, fon rejimida, holat so'rab turiladi):
  - Claude vision bilan watermark aniqlash → OpenCV (WASM) inpainting → sharp trim → WebP 1280 / 80.
  - Alohida "Fonni kesish" tugmasi (@imgly, mahalliy).
  - "Oldin / Keyin" ko'rinishi; "Qayta urinish", "Asl rasm", qo'lda crop / o'chirish.
  - Asl rasm yopiq saqlanadi; saytga faqat tasdiqlangan versiya chiqadi: `/media/<id>.webp`.

**5-bosqich — statistika.**
- Hodisalar `AnalyticsEvent`ga yig'iladi: batch, IP / UA / ism / telefonsiz.
- `/admin/dashboard` (bugun / 7 / 30 kun): DAU, WAU, MAU, ro'yxat, to'lov, konversiya, sessiya vaqti, mavzular, tashlab ketilgan testlar, 20 ta qiyin savol, kunlar voronkasi, qurilmalar.
- `/admin/ai`: yig'ma statistikadan hisobot, hisobotlar bazada saqlanadi, hisobot bo'yicha savol-javob. Haftalik Vercel Cron: dushanba 04:00 UTC, `/cron/weekly-report`.

### Sxema (6 ta yangi migratsiya; orqaga qaytarish SQL'lari `backend/prisma/down/`da)

| Migratsiya | Nima qo'shadi |
|---|---|
| `admin_auth` | `Admin`, `AdminSession`, `AdminLoginAttempt`, `AuditLog` |
| `users_payments` | User'ga profil ustunlari (`phone` unikal, `firstName`, `lastName`, `age`, `examStatus`, `phoneVerifiedAt`, `registeredAt`, `lastActiveAt`, `paymentStatus`, `accessGrantedAt`); Session'ga `userAgent`, `lastSeenAt`; `Payment`, `AnswerLog` |
| `content_new_tests` | Topic'ga `kind`, `published`, `sortOrder`, `deletedAt`; Question'ga `deletedAt`, `imageAssetId`; `MediaAsset`, `ImageJob` |
| `analytics_ai` | `AnalyticsEvent`, `AiReport`, `AiReportMessage` |

Barcha o'zgarishlar qo'shimcha: eski kod yangi sxema bilan ham ishlaydi.

### Yangi endpointlar

| Tomon | Endpointlar |
|---|---|
| Foydalanuvchi | `GET /me`, `POST /me/register`, `PUT /me/language`, `POST /payments/request`, `GET /payments/mine`, `GET /collections`, `POST /events`, `GET /media/:id.webp` |
| Admin: kirish va audit | `auth/login\|logout\|me\|change-password`, `audit`, `audit/logins` |
| Admin: foydalanuvchilar va to'lovlar | `users`, `users/export.csv`, `users/:id`, `payments`, `payments/:id/confirm\|cancel` |
| Admin: kontent | `content/days`, `content/topics/:slug/questions`, `questions/:id` (GET / PUT / DELETE), `questions/:id/reviewed`, `questions/similar` |
| Admin: yangi testlar va rasmlar | `collections` (CRUD, `reorder`, `:id/questions`), `images`, `images/jobs`, `images/accept`, `images/assets/:id` |
| Admin: statistika va AI | `stats/dashboard`, `ai/status\|translate\|reports\|reports/:id/ask` |
| Cron | `GET /cron/weekly-report` |

Barcha admin endpointlari `/admin/` ostida.

### Sahifalar

`/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/users/[id]`, `/admin/payments`, `/admin/content`, `/admin/content/[slug]`, `/admin/questions/[id]`, `/admin/new-tests`, `/admin/new-tests/[id]`, `/admin/new-tests/[id]/new`, `/admin/ai`, `/admin/history`, `/admin/settings`.

### Tekshiruv

| Tekshiruv | Natija |
|---|---|
| `npm run build` / `lint` (frontend va backend) | toza (3 ta ataylab qilingan ogohlantirish) |
| Unit (frontend) | 134 / 134 |
| E2E (backend) | 72 / 72: admin guard, login rate limit, to'g'ri javob va diapazon validatsiyasi, kirish huquqi, rasm, statistika |
| Playwright, lokal | 35 / 35 |
| Playwright, preview | 23 / 24 + qayta tekshiruv 10 / 10. Yagona xato — `/admin/ai`da `load` hodisasini kutish timeout'i; sahifa 2.3 s'da ochildi |

Playwright 390px va 1280px kengliklarda tekshirildi; network'da to'g'ri javob yoki kalit so'z yo'qligi ham tekshirildi.

## 2. Production holati

- **Sayt:** https://pravatayyor.vercel.app. **Admin:** https://pravatayyor.vercel.app/admin/login. **Backend:** https://pravatayyor-backend.vercel.app.
- **Zaxira:** `~/PravaTayyor-backups/prod-before-admin-panel-2026-10-28.dump` (pg_dump, 600), migratsiyadan oldin olingan.
- **Migratsiyalar:** production bazada qo'llangan (preview backend build'i orqali — preview va production bitta Neon bazani ishlatadi).
- **Adminlar:** `owner` (OWNER) va `developer` (DEVELOPER) yaratilgan.
- **Smoke test:**
  - sayt ochiladi, `robots.txt` to'g'ri;
  - to'lovsiz test yopiq (403);
  - owner bilan kirish ishlaydi, to'lov tasdiqlanadi;
  - day1-topic1 testi ochiladi, javob tekshiriladi, kalit so'zlar ko'rinadi;
  - network'da javob ko'rinmaydi.
- Test uchun yaratilgan foydalanuvchilar, to'lovlar, to'plam, rasmlar, hodisalar va audit yozuvlari o'chirildi. O'zgartirilgan 6-kun savoli asl holiga qaytarildi.
- **Rollback (kerak bo'lsa):** `vercel rollback` ikkala loyihada. Migratsiyalar qo'shimcha, ularni qaytarish shart emas (SQL'lar `prisma/down/`da).

## 3. AI qismlari

`ANTHROPIC_API_KEY` mavjud `.env` fayllarida ham, Vercel env'larida ham topilmadi. Shuning uchun AI qismlari "sozlanmagan" holatda:
- watermark aniqlash;
- ruscha tarjima;
- AI tahlil va haftalik hisobot.

Qolgan hamma narsa ishlaydi: qo'lda o'chirish, crop, fon kesish, dashboard.

Model: `claude-opus-5-5` ($4 / $20 per 1M token). Taxminiy narx:

| Amal | Bir marta |
|---|---|
| Rasm aniqlash | ~$0.02 |
| Savol tarjimasi | ~$0.03 |
| Hisobot | ~$0.10 |
| Hisobot bo'yicha savol | ~$0.05 |

Oyiga 100 ta rasm + 100 ta tarjima + 4 haftalik va ~10 qo'lda hisobot ≈ **$6–10/oy**.

## 4. Qilinmagan / keyinga qolgan va xavflar

- **To'lov majburiyati yoqildi.** Avval mock to'lov bilan "faol" bo'lgan qurilmalar endi kursni ko'rish uchun admin tasdig'ini kutadi. Ular kirganda avtomatik "kutilmoqda" so'rovi tushadi.
  - O'chirish kerak bo'lsa: backend env'da `PAYMENT_ENFORCED=false`, keyin `vercel deploy --prod`.
- **Ikkinchi qurilma.** Telefon OTP (Eskiz) ulanmaguncha bir raqam ikkinchi qurilmada ro'yxatdan o'tolmaydi (409, "administratorga murojaat qiling"). Admin panelda qurilmani qo'lda ulash hali yo'q.
- **Eskiz branch'i bilan birlashtirish.** Ustun nomlari mos. Eskiz'dagi User migratsiyasini olib tashlash kerak, `normalizePhone` esa `+998…` qaytaradigan qilinadi.
- **Rasm yuklash hajmi.** Vercel'da so'rov tanasi 4.5 MB bilan cheklangan. Kattaroq rasm brauzerda kichraytiriladi; serverdagi chegara 10 MB.
- **Fon kesish.** Modeli og'ir (~280 MB paket). Vercel'da ishlashi va vaqti real yuklamada kuzatilishi kerak (`maxDuration` 300 s).
- **Videolar boshqaruvi** — qarorga ko'ra qilinmadi.
- **Preview va production bitta bazada.** Kelajakdagi preview deploy'lar ham production migratsiyasini ishga tushiradi. Neon branch ajratish tavsiya qilinadi.

## 5. Yetishmagan narsa

`ANTHROPIC_API_KEY` → Vercel'dagi `pravatayyor-backend` loyihasiga (Production / Preview / Development), keyin `vercel deploy --prod`.
