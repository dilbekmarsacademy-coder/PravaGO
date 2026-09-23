// Mock kurs tuzilmasi (kunlar + mavzular). Backend/admin panel tayyor bo'lgach
// bu massivlar o'rniga real API javobi ishlatiladi — quyi qatlamdagi hech bir
// komponent buni bilmasligi kerak (faqat `lib/api/course.ts` orqali murojaat qiling).
//
// Mavzu-kun taqsimoti kelajakda admin paneldan boshqariladi, shuning uchun bu
// yerdagi raqamlar/nomlar faqat namuna — komponentlar ichida qattiq kodlanmagan.

import type { Day, Topic } from "@/lib/course-types";

export const MOCK_DAYS: Day[] = [
  { id: "day-1", number: 1, title: "1-kun", topicIds: ["topic-14", "topic-15", "topic-22", "topic-23", "topic-24", "topic-25", "topic-26"] },
  { id: "day-2", number: 2, title: "2-kun", topicIds: ["topic-27", "topic-28", "topic-29", "topic-30"] },
  { id: "day-3", number: 3, title: "3-kun", topicIds: ["topic-31", "topic-32", "topic-33"] },
  { id: "day-4", number: 4, title: "4-kun", topicIds: ["topic-34", "topic-35", "topic-36", "topic-37", "topic-38"] },
  { id: "day-5", number: 5, title: "5-kun", topicIds: ["topic-39", "topic-40", "topic-41"] },
  { id: "day-6", number: 6, title: "6-kun", topicIds: ["topic-42", "topic-43", "topic-44", "topic-45"] },
  { id: "day-7", number: 7, title: "7-kun — Yakuniy imtihon", topicIds: [] },
];

export const MOCK_TOPICS: Topic[] = [
  // 1-kun — TZ bo'yicha belgilangan rasmiy mavzu raqamlari
  { id: "topic-14", number: 14, title: "Yo'l belgilari: ogohlantiruvchi belgilar", dayId: "day-1", videoDurationSec: 480 },
  { id: "topic-15", number: 15, title: "Yo'l belgilari: imtiyoz belgilari", dayId: "day-1", videoDurationSec: 420 },
  { id: "topic-22", number: 22, title: "Chorrahalarda harakatlanish tartibi", dayId: "day-1", videoDurationSec: 600 },
  { id: "topic-23", number: 23, title: "Temir yo'l kesishmalaridan o'tish", dayId: "day-1", videoDurationSec: 360 },
  { id: "topic-24", number: 24, title: "Yo'lovchilar tashish qoidalari", dayId: "day-1", videoDurationSec: 300 },
  { id: "topic-25", number: 25, title: "Yuk tashish qoidalari", dayId: "day-1", videoDurationSec: 330 },
  { id: "topic-26", number: 26, title: "Javobgarlik va jarimalar", dayId: "day-1", videoDurationSec: 420 },

  // 2-kun — namunaviy mavzular
  { id: "topic-27", number: 27, title: "Yo'l harakati xavfsizligi asoslari", dayId: "day-2", videoDurationSec: 540 },
  { id: "topic-28", number: 28, title: "Svetofor va reguirovchi ishoralari", dayId: "day-2", videoDurationSec: 480 },
  { id: "topic-29", number: 29, title: "Yetib olish va aylanib o'tish", dayId: "day-2", videoDurationSec: 510 },
  { id: "topic-30", number: 30, title: "To'xtash va turish qoidalari", dayId: "day-2", videoDurationSec: 390 },

  // 3-kun
  { id: "topic-31", number: 31, title: "Piyodalar va velosipedchilarga nisbatan", dayId: "day-3", videoDurationSec: 450 },
  { id: "topic-32", number: 32, title: "Tezlik chegaralari", dayId: "day-3", videoDurationSec: 360 },
  { id: "topic-33", number: 33, title: "Avtomagistrallarda harakatlanish", dayId: "day-3", videoDurationSec: 420 },

  // 4-kun
  { id: "topic-34", number: 34, title: "Transport vositasini yo'lga tayyorlash", dayId: "day-4", videoDurationSec: 300 },
  { id: "topic-35", number: 35, title: "Faol va nofaol xavfsizlik vositalari", dayId: "day-4", videoDurationSec: 330 },
  { id: "topic-36", number: 36, title: "Ekologik talablar", dayId: "day-4", videoDurationSec: 270 },
  { id: "topic-37", number: 37, title: "Birinchi tibbiy yordam asoslari", dayId: "day-4", videoDurationSec: 540 },
  { id: "topic-38", number: 38, title: "Baxtsiz hodisa vaqtidagi harakatlar", dayId: "day-4", videoDurationSec: 480 },

  // 5-kun
  { id: "topic-39", number: 39, title: "Sug'urta va zarur hujjatlar", dayId: "day-5", videoDurationSec: 300 },
  { id: "topic-40", number: 40, title: "Transport vositasini boshqarish texnikasi", dayId: "day-5", videoDurationSec: 450 },
  { id: "topic-41", number: 41, title: "Murakkab ob-havo sharoitida harakatlanish", dayId: "day-5", videoDurationSec: 420 },

  // 6-kun
  { id: "topic-42", number: 42, title: "Tungi vaqtda harakatlanish", dayId: "day-6", videoDurationSec: 360 },
  { id: "topic-43", number: 43, title: "Shahar tashqarisida harakatlanish", dayId: "day-6", videoDurationSec: 390 },
  { id: "topic-44", number: 44, title: "Umumiy takrorlash: qiyin biletlar", dayId: "day-6", videoDurationSec: 600 },
  { id: "topic-45", number: 45, title: "Yakuniy tayyorgarlik", dayId: "day-6", videoDurationSec: 480 },
];
