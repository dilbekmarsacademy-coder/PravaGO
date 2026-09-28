# "Saqlanganlar" API

Barcha endpointlar sessiya talab qiladi: `Authorization: Bearer <token>`
(token `POST /auth/session` orqali olinadi, frontendda `src/lib/api/session.ts`).
`userId` faqat sessiyadan olinadi — body yoki query'da yuborilsa `400`
(`forbidNonWhitelisted`).

To'g'ri javob (`correctOptionId`) va kalit so'z (`keyword`) **faqat**
`GET /saved` javobida keladi. Test yechish API'lari (`GET /topics/:slug/questions`,
`GET /saved/practice`) ularni hech qachon qaytarmaydi.

Matnlar `{ uz?, cyrl?, ru? }` ko'rinishida keladi (test API bilan bir xil);
frontend `localize()` orqali tanlangan tilni ko'rsatadi, yetishmagan o'zbek
yozuvini transliteratsiya qiladi.

## Xato formati

```json
{ "statusCode": 400, "message": ["questionId must be a UUID"], "error": "Bad Request" }
```

| Status | Qachon |
|---|---|
| 400 | Validatsiya (noto'g'ri UUID, `sourceMode`, `note` > 500, noto'g'ri `cursor`, `limit` > 50) |
| 401 | Token yo'q, soxta yoki muddati o'tgan |
| 404 | Savol / urinish / saqlangan yozuv topilmadi (boshqa foydalanuvchiniki ham — 404) |
| 409 | `code: "SAVED_LIMIT_REACHED"` — 1000 tadan ortiq saqlab bo'lmaydi |
| 429 | Rate limit: saqlash/o'chirish/izoh — foydalanuvchi boshiga daqiqasiga 60 ta |

## POST /saved

Idempotent: yangi saqlansa `201`, allaqachon saqlangan bo'lsa `200` va mavjud yozuv.

```http
POST /saved
{ "questionId": "5b0c…", "sourceMode": "practice" }
{ "questionId": "5b0c…", "sourceMode": "exam", "attemptId": "a1f3…" }
```

```json
201
{
  "questionId": "5b0c…",
  "topicSlug": "1-kun-2-mavzu-tartibga-soluvchining-ishoralari",
  "sourceMode": "practice",
  "attemptId": null,
  "note": null,
  "createdAt": "2026-09-28T09:12:44.120Z"
}
```

`sourceMode: "exam"` da `attemptId` majburiy va joriy foydalanuvchiga tegishli bo'lishi kerak.

## DELETE /saved/:questionId

Idempotent — yozuv bo'lmasa ham `204`.

## PATCH /saved/:questionId

```http
PATCH /saved/5b0c…
{ "note": "Yashil — yurish mumkin" }     // null yoki "" — izohni o'chiradi
```

`200` + yozuv (yuqoridagi format). Saqlanmagan savol — `404`.

## GET /saved/ids?topicSlug=

Test sahifasidagi xatchop holati uchun — faqat id'lar.

```json
{ "ids": ["5b0c…", "9e21…"] }
```

## GET /saved/count

```json
{ "total": 12, "limit": 1000, "byTopic": [{ "topicSlug": "1-kun-2-mavzu-…", "count": 12 }] }
```

## GET /saved?lang=&topicSlug=&q=&sort=&cursor=&limit=

| Param | Qiymat |
|---|---|
| `lang` | `uz-latn` \| `uz-cyrl` \| `ru` — `q` qaysi til matni bo'yicha qidirilishi |
| `topicSlug` | mavzu filtri |
| `q` | savol matni bo'yicha qidiruv (≤ 100 belgi, katta-kichik harf farqsiz) |
| `sort` | `new` (sukut) \| `old` |
| `cursor` | oldingi javobdagi `nextCursor` |
| `limit` | 1–50, sukut 20 |

```json
{
  "items": [
    {
      "questionId": "5b0c…",
      "topicSlug": "1-kun-2-mavzu-tartibga-soluvchining-ishoralari",
      "sourceMode": "practice",
      "attemptId": null,
      "note": null,
      "createdAt": "2026-09-28T09:12:44.120Z",
      "question": {
        "order": 3,
        "text": { "cyrl": "Қайси транспорт воситасига ҳаракатланишга рухсат берилади?", "ru": "…" },
        "imageUrl": "https://…/images/q03.jpg",
        "imageWidth": 900,
        "imageHeight": 506,
        "options": [{ "id": "o1", "text": { "cyrl": "…", "ru": "…" } }]
      },
      "answerLocked": false,
      "correctOptionId": "o2",
      "keyword": { "uz": "YENGIL AVTOMOBILGA", "ru": "…" }
    }
  ],
  "nextCursor": "WyIyMDI2LTA5LTI4VDA5OjEyOjQ0LjEyMFoiLCI…"
}
```

Kursor — oxirgi elementning `(createdAt, id)` jufti: sahifalar orasida yangi
savol saqlansa ham takror yoki tushib qolish bo'lmaydi.

**Imtihon qoidasi:** `sourceMode = "exam"` va urinish hali yakunlanmagan
(`ExamAttempt.finishedAt = null`) bo'lsa — `answerLocked: true`, `correctOptionId`
va `keyword` JSON'da umuman bo'lmaydi. Urinish yakunlangach avtomatik ochiladi.

## GET /saved/practice?topicSlug=

"Saqlanganlarni test qilib ishlash" uchun — test API bilan bir xil ochiq format
(javobsiz), har bir savolda `topicSlug`. Yakunlanmagan imtihon savollari kirmaydi.
Javob odatiy `POST /questions/:id/check-answer` orqali tekshiriladi.

## Ma'lumotlar bazasi

Migratsiya: `prisma/migrations/20260927115155_add_saved_questions` —
`User`, `Session`, `ExamAttempt`, `SavedQuestion` jadvallari,
`UNIQUE(userId, questionId)`, indekslar `(userId, createdAt DESC)` va
`(userId, topicId)`, barcha yangi jadvallarda RLS yoqilgan (API ulanadigan
egadan boshqa rollar uchun policy yo'q).
