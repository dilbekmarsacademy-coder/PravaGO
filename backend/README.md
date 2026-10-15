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

> Hozircha `questions.json` bo'sh (`[]`) — test banklari mavzuma-mavzu
> qaytadan qo'shiladi. Bo'sh fayl bilan seed xatosiz o'tadi.

## Yangi mavzuga video va test qo'shish

Har bir mavzuning barqaror ID'si bor: `day1-topic1` … `day1-topic7`,
`day2-topic1` … (frontend: `src/data/curriculum.ts`). Video va test shu ID'ga
ulanadi. Video ham, test ham bo'lmagan mavzu kabinetda "Tez orada" bo'lib
ko'rinadi va keyingi mavzularni qulflamaydi.

**1. Test banki** (masalan `day1-topic1` uchun):

1. Rasmlarni `prisma/seed-data/images/` ga qo'ying.
2. `prisma/seed-data/questions.json` ga savollarni qo'shing — `topic` maydoni
   mavzu ID'si bilan bir xil bo'lsin:
   ```json
   { "id": 1, "topic": "day1-topic1", "text": "Савол матни", "image": "d1t1-q01.jpg",
     "options": [{ "id": "a", "text": "Жавоб" }, { "id": "b", "text": "Жавоб" }],
     "correctOptionId": "a", "keyword": "Калит сўз" }
   ```
   Ruscha tarjima (ixtiyoriy) — `questions.ru.json` da savol `id` si bo'yicha.
   `id` (tartib) mavzu ichida takrorlanmasin.
3. `prisma/seed.ts` → `TOPIC_TITLES` ga sarlavha qo'shing:
   `"day1-topic1": "1-kun 1-mavzu: Svetofor ishoralari"`.
4. `npm run seed`.
5. Frontend: `src/data/curriculum.ts` da mavzuga `testSlug: "day1-topic1"` qo'shing.

**2. Video dars** — faqat backend'da, bitta qator:

`src/lessons/lessons.config.ts` → `LESSONS`:
`"day2-topic1": { videoId: "VIDEO_ID", durationSec: 1234 },`

- Kalit — mavzu ID'si. `durationSec` — videoning aniq davomiyligi (soniya);
  "ko'rildi" holati shunga qarab serverda hisoblanadi.
- `topicSlug` ixtiyoriy (standart — kalitning o'zi): shu dars ochadigan test banki.
- 1-kun mavzularida frontend'da `lessonId` allaqachon yozilgan — ular uchun
  yuqoridagi qatorning o'zi yetarli (masalan day1-topic7). Boshqa kunlarda
  `src/data/curriculum.ts` dagi mavzuga `lessonId: "dayN-topicM"` ham qo'shing.
- Video ID frontend kodiga hech qachon yozilmaydi: klient uni sessiya bilan
  `GET /lessons/:lessonId/video` orqali oladi.

Endpointlar (hammasi sessiya talab qiladi):
- `GET /lessons` — barcha darslar holati (kabinetdagi foizlar);
- `GET /lessons/:lessonId` — holat; xaritada yo'q dars — 404 `LESSON_NOT_FOUND`
  (frontend "video hali olinmagan" ekranini ko'rsatadi);
- `GET /lessons/:lessonId/video` — video ID;
- `POST /lessons/:lessonId/progress` — `{ position, maxPosition, watchedDelta }`.
  Server eng uzoq nuqtani hisobotlar orasidagi real vaqt × 2 (maksimal tezlik)
  + 2 s dan ortiq oshirmaydi. Foiz = eng uzoq nuqta / davomiylik; "ko'rildi" —
  ≥ 98% va oxirigacha yetilgan (faqat serverda).

Ikkalasi ham bo'lsa: mavzu sahifasida avval video, test esa video oxirigacha
ko'rilgandan keyin ochiladi (backend ham `GET /topics/:slug/questions` ni shu
vaqtgacha 403 `LESSON_NOT_COMPLETED` bilan yopadi). Faqat test bo'lsa — mavzu
bosilganda to'g'ridan-to'g'ri test boshlanadi. Faqat video bo'lsa — "Test
ishlash" tugmasi ko'rilgandan keyin "tez orada" modalini ochadi.

**Kontentni butunlay tozalash** (savollar, mavzular, saqlanganlar, imtihon
urinishlari, video progress; foydalanuvchilar qoladi):

```bash
npm run content:clear   # DATABASE_URL dagi bazada
```

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
