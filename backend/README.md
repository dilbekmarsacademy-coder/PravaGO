# PravaTayyor — Backend (NestJS)

Test/Savollar moduli: mavzular, savollar va variantlarni saqlaydi, hamda
frontend uchun ikkita ochiq endpoint beradi. To'g'ri javob va kalit so'z
faqat foydalanuvchi javob yuborgandan keyin, faqat o'sha bitta savol uchun
qaytariladi — savollar ro'yxati so'ralganda hech qachon chiqmaydi.

## Texnologiyalar

- NestJS (TypeScript)
- PostgreSQL + Prisma ORM
- `helmet`, CORS (faqat `ALLOWED_ORIGIN`), `@nestjs/throttler` (rate-limit)

## Endpointlar

- `GET /topics/:slug/questions` — mavzudagi barcha savollar (`correctOptionId`
  va `keyword` YO'Q).
- `POST /questions/:id/check-answer` — body: `{ "optionId": string }`,
  javob: `{ correct, correctOptionId, keyword }`. Bitta IP daqiqasiga 20 ta
  so'rov bilan cheklangan.

## Mahalliy ishga tushirish

```bash
cd backend
npm install
cp .env.example .env   # DATABASE_URL, ALLOWED_ORIGIN, PUBLIC_BASE_URL to'ldiring
npx prisma migrate dev --name init
npm run seed            # questions.json + images/ ni DB va public/images/ ga yozadi
npm run start:dev
```

Seed manbai `prisma/seed-data/questions.json` va `prisma/seed-data/images/`
papkalarida saqlanadi (repo bilan birga keladi). `npm run seed` bu fayllarni
o'qib DB'ga yozadi va rasmlarni `public/images/` ga nusxalaydi — bu skript
xavfsiz tarzda qayta-qayta ishga tushirilishi mumkin (mavjud yozuvlarni
yangilaydi, dublikat yaratmaydi).

> **Eslatma:** manba `questions.json`dagi 15-savol ikkilanishli javob bilan
> keldi (`correctOptionId` bir nechta variant), shuning uchun seed skripti
> uni avtomatik `needsReview=true` deb belgilaydi va hech qaysi variantni
> to'g'ri deb belgilamaydi. Bunday savol uchun `check-answer` chaqirilsa,
> backend to'g'ri javob hali belgilanmagani haqida xato qaytaradi — buni
> to'g'ridan-to'g'ri DB'da (`Option.isCorrect`) qo'lda tuzatish kerak.

## Bepul deploy: Render (API) + Supabase (Postgres)

### 1. Supabase'da Postgres yaratish

1. https://supabase.com → New Project.
2. Project tayyor bo'lgach: **Project Settings → Database → Connection
   string → URI** dan ulanish satrini oling (parolni albatta kiritilgan
   holatda nusxalang).
3. Bu qiymatni keyingi qadamda `DATABASE_URL` sifatida ishlatasiz.

### 2. Render'da Web Service yaratish

1. https://render.com → New → Web Service → GitHub repo'ni ulang.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install && npx prisma migrate deploy && npm run build`
4. **Start Command**: `npm run start:prod`
5. **Environment Variables** (Render dashboard → Environment):
   - `DATABASE_URL` — Supabase'dan olingan ulanish satri
   - `ALLOWED_ORIGIN` — frontend domeningiz (masalan
     `https://pravatayyor.vercel.app`)
   - `PUBLIC_BASE_URL` — shu Render service'ning o'z URL'i (masalan
     `https://pravatayyor-api.onrender.com`) — seed skripti rasm URL'larini
     shundan yasaydi
   - `PORT` — Render buni avtomatik beradi, qo'lda kerak emas

### 3. Ma'lumotlarni import qilish

Render'da bitta martalik Shell/Job orqali (Render dashboard → Shell) yoki
lokal kompyuteringizdan `DATABASE_URL` va `PUBLIC_BASE_URL`ni Render/Supabase
qiymatlariga o'rnatib:

```bash
npm run seed
```

Bu rasmlarni `public/images/`ga yozadi — Render Free tarifda disk vaqtinchalik
(deploy'lar orasida saqlanmasligi mumkin), shuning uchun bu skriptni har bir
yangi deploy'dan keyin **build bosqichining bir qismi sifatida** ham
ishlatish tavsiya etiladi (masalan Build Command'ga `&& npm run seed`
qo'shib qo'yish) — skript idempotent, xavfsiz qayta ishga tushadi.

### 4. Tekshirish

```bash
curl https://<render-service>.onrender.com/topics/1-kun-2-mavzu-tartibga-soluvchining-ishoralari/questions
```

Javobda `correctOptionId` yoki `keyword` yo'qligiga ishonch hosil qiling.

## Muhit o'zgaruvchilari

| Nom | Tavsif |
|---|---|
| `DATABASE_URL` | Supabase Postgres ulanish satri |
| `ALLOWED_ORIGIN` | CORS uchun ruxsat etilgan frontend domen(lar), vergul bilan |
| `PORT` | Server porti (Render avtomatik beradi) |
| `PUBLIC_BASE_URL` | Seed skripti rasm URL'larini shu asosda yasaydi |
