/** Mavzu testi "tugagan" deb hisoblanishi uchun kerakli eng kam foiz. */
export const PASS_PERCENT = 98;

/** Yakuniy imtihon uchun ruxsat etilgan maksimal urinishlar soni. */
export const FINAL_EXAM_MAX_ATTEMPTS = 10;

/**
 * Yakuniy imtihon oqimi (savollarni tanlash, vaqt hisoblagichi, natija sahifasi)
 * hali qurilmagan — shuning uchun Dastur xaritasidagi 7-kun kartochkasi progress
 * hisob-kitobidan qat'i nazar hozircha doim qulflangan ko'rinishda chiqadi.
 * Oqim tayyor bo'lgach shu bayroqni true qilish kifoya.
 */
export const FINAL_EXAM_FLOW_ENABLED = false;

/**
 * Mavzu testi uchun vaqt chegarasi (soniya). Hozircha sinov uchun 1 daqiqa —
 * keyinroq ko'paytiriladi.
 */
export const TOPIC_TEST_TIME_LIMIT_SEC = 60;

/** Vaqt tugaganda natija ko'rsatilgach kabinetga avtomatik o'tishgacha soniyalar. */
export const TIME_UP_REDIRECT_SEC = 5;

/** Imtihon rejimida o'tish uchun kerakli to'g'ri javoblar (20 tadan). */
export const EXAM_PASS_CORRECT = 18;
