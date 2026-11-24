# Payme Merchant API

Endpoint: `POST https://pravatayyor-backend.vercel.app/payments/payme` (JSON-RPC 2.0, `account` maydoni: `order_id`).

## Env (`pravatayyor-backend`)

| O'zgaruvchi | Qiymat |
|---|---|
| `PAYMENTS_ENABLED` | `true` — tugmalar ko'rinadi, `create-order` ishlaydi. `false` — yashirin, 503 (webhook baribir ishlaydi) |
| `PAYME_ENV` | `test` yoki `prod` |
| `PAYME_MERCHANT_ID` | kassa ID |
| `PAYME_TEST_KEY` | sandbox kaliti |
| `PAYME_KEY` | jonli kalit |
| `PAYME_TEST_USERS` | production saytda `PAYME_ENV=test` paytida to'lov qila oladigan `User.id`lar (vergul bilan). Sandbox kartalari ochiq bo'lgani uchun boshqalarga yopiq |

Env o'zgargach backend qayta deploy qilinadi. Frontendda yangi env kerak emas.

## Tariflar (`backend/src/payments/tariffs.ts`)

| Tarif | So'm | Payme summasi (tiyin) | Muddat | Video |
|---|---|---|---|---|
| `STANDART_7` | 25 000 | 2 500 000 | 7 kun | yo'q |
| `STANDART_14` | 48 000 | 4 800 000 | 14 kun | yo'q |
| `STANDART_30` | 75 000 | 7 500 000 | 30 kun | yo'q |
| `PREMIUM` | 300 000 | 30 000 000 | muddatsiz (`expiresAt = null`) | bor |
| `MENTOR` | 500 000 | 50 000 000 | muddatsiz (`expiresAt = null`) | bor + jonli dars (admin qo'lda tayinlaydi) |

Saytdagi nusxa — `src/config/tariffs.ts`; mosligini `src/config/tariffs.test.ts` tekshiradi.

## Ishga tushirish

1. DB zaxirasi (pg_dump).
2. `cd backend && vercel deploy --prod` — build `prisma migrate deploy` ni o'zi bajaradi (lokalda: `npm run prisma:migrate`).
3. `main` push — frontend.
4. Sandbox: `PAYMENTS_ENABLED=true`, `PAYME_ENV=test`, `PAYME_TEST_USERS=<o'zingizning id>`; https://test.paycom.uz da barcha ssenariylar.
5. Jonli: `PAYME_ENV=prod`, `PAYME_KEY`; kabinetda endpoint manzili.

## Qoidalar

- Har doim HTTP 200; xato `error` da. `-32504` avtorizatsiya, `-31001` summa, `-31003` tranzaksiya yo'q, `-31008` bajarib bo'lmaydi, `-31050` buyurtma yo'q, `-31099` buyurtma band/to'langan/bekor.
- Bajarilmagan tranzaksiya 12 soatdan keyin bekor (reason 4): keyingi Create/Perform yoki holat so'rovida yoziladi.
- Tranzaksiya bekor bo'lsa buyurtma ham `CANCELLED` — qayta to'lash uchun yangi buyurtma.
- Standart muddatlari ketma-ket qo'shiladi; qaytarilganda faqat o'sha to'lov muddati olinadi.
- Premium/Mentor muddatsiz va Standart to'lovi bilan pasaymaydi. Muddatsiz kirishi borga Standart yoki o'sha tarif sotilmaydi (409 / -31099).
- Videosiz cheklov faqat kirishi onlayn Standart bilangina ochilgan foydalanuvchiga tegishli.
- Admin qo'lda tasdiqlagan to'lov muddatsiz va bundan mustaqil.

## curl (lokal)

```bash
API=http://localhost:3001
AUTH="Paycom:$PAYME_TEST_KEY"
rpc() { curl -s -u "$AUTH" -H 'Content-Type: application/json' "$API/payments/payme" -d "$1"; echo; }
NOW=$(($(date +%s) * 1000))

# Buyurtma (foydalanuvchi tokeni)
curl -s -X POST "$API/payments/create-order" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"tariff":"STANDART_14"}'
ORDER=<javobdagi id>
curl -s "$API/payments/order/$ORDER" -H "Authorization: Bearer $TOKEN"

rpc '{"id":1,"method":"CheckPerformTransaction","params":{"amount":4800000,"account":{"order_id":"'$ORDER'"}}}'
rpc '{"id":2,"method":"CreateTransaction","params":{"id":"test-1","time":'$NOW',"amount":4800000,"account":{"order_id":"'$ORDER'"}}}'
rpc '{"id":3,"method":"PerformTransaction","params":{"id":"test-1"}}'
rpc '{"id":4,"method":"CheckTransaction","params":{"id":"test-1"}}'
rpc '{"id":5,"method":"CancelTransaction","params":{"id":"test-1","reason":5}}'
rpc '{"id":6,"method":"GetStatement","params":{"from":'$((NOW - 86400000))',"to":'$NOW'}}'

# Xatolar: -32504 va -31001
curl -s -u Paycom:xato -H 'Content-Type: application/json' "$API/payments/payme" -d '{"id":7,"method":"CheckTransaction","params":{"id":"test-1"}}'
rpc '{"id":8,"method":"CheckPerformTransaction","params":{"amount":1,"account":{"order_id":"'$ORDER'"}}}'
```

Testlar: `cd backend && npx vitest run test/payme.e2e-spec.ts`
