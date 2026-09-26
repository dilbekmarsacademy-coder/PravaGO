import type { Dictionary } from "../dictionary";
import { formatNumber } from "../localized";

const num = (value: number) => formatNumber(value, "uz-latn");

export const uzLatn: Dictionary = {
  meta: {
    title: "PravaTayyor — Haydovchilik imtihoniga tayyorgarlik",
    description:
      "Respublika miqyosidagi onlayn haydovchilik (prava) imtihoniga tayyorgarlik platformasi.",
  },

  header: {
    brand: "PravaTayyor",
    nav: {
      boshSahifa: "Bosh sahifa",
      dastur: "Dastur",
      qandayIshlaydi: "Qanday ishlaydi",
      natijalar: "Natijalar",
      narxlar: "Narxlar",
      bizHaqimizda: "Biz haqimizda",
    },
    kirish: "Kirish",
    tezOrada: "Tez orada",
    royxatdanOtish: "Ro'yxatdan o'tish",
    menyuniOchish: "Menyuni ochish",
    menyuniYopish: "Menyuni yopish",
  },

  hero: {
    badge: "Revolyutsion haydovchilik platformasi",
    titlePre: "Prava imtihonini ",
    titleHighlight: "1-urinishdayoq",
    titlePost: " topshiring!",
    subtitle:
      "63 ta bilet, 1 260 ta interaktiv savol va 7 kunlik avtotest simulyatsiyasi — tizimli tayyorgarlik uchun barchasi bitta joyda.",
    ctaPrimary: "Tayyorlanishni boshlash",
    ctaSecondary: "Qanday ishlashini ko'rish",
    note: "Ro'yxatdan o'tish 1 daqiqadan kam vaqt oladi",
  },

  trustStats: {
    items: [
      { value: "63", unit: "BILET", desc: "To'liq yangilangan bazasi" },
      { value: "1 260", unit: "SAVOL", desc: "Rasmiy YHXBB imtihon bazasi" },
      { value: "6+1", unit: "KUN", desc: "Bosqichma-bosqich tezlashtirilgan tizim" },
      { value: "98%", unit: "PASSRATE", desc: "Keyingi bosqichga o'tish talabi" },
    ],
  },

  examStatusOptions: [
    {
      value: "first-time",
      title: "Birinchi marta topshiraman",
      desc: "Hali imtihonga kirmaganman.",
    },
    {
      value: "failed-before",
      title: "Oldin imtihondan yiqilganman",
      desc: "Qayta tayyorlanmoqchiman.",
    },
    {
      value: "license-revoked",
      title: "Guvohnomam bekor qilingan",
      desc: "Qayta imtihonga tayyorlanyapman.",
    },
  ],

  categorySection: {
    heading: "Siz qaysi holatdasiz?",
    cta: "Men uchun",
  },

  howItWorks: {
    eyebrow: "Race track",
    heading: "7 kunda tayyorgarlik tizimi",
    steps: [
      { title: "Video darsni ko'ring", desc: "Mavzu bo'yicha qisqa video dars" },
      { title: "Mavzu testini ishlang", desc: "Bilimni testda mustahkamlang" },
      { title: "98% natijaga yeting", desc: "Talab qilingan natijaga chiqing" },
      { title: "Keyingi mavzuni oching", desc: "Dastur avtomatik davom etadi" },
      { title: "7-kun yakuniy imtihon", desc: "Yakuniy nazorat imtihonini topshiring" },
    ],
  },

  productPreview: {
    eyebrow: "Platforma",
    heading: "Hamma narsa bir joyda",
    desc: "Video darsdan tortib yakuniy ichki imtihongacha — butun tayyorgarlik jarayoni bitta shaxsiy kabinetda, aniq bosqichlar bilan boshqariladi.",
    checklist: [
      "Mavzuli video darslar",
      "1 260 ta rasmiy savol",
      "Avtomatik natija nazorati",
      "Qayta ishlash imkoniyati",
      "Yakuniy ichki imtihon",
    ],
    cta: "Tayyorlanishni boshlash",
    shaxsiyKabinet: "Shaxsiy kabinet",
    online: "ONLINE",
    kun: "kun",
    bugungiVazifa: "Bugungi vazifa",
    vazifaTitle: "5-mavzu: Chorrahalarda harakatlanish",
    vazifaDesc: "Video dars + 20 savollik test",
    bilet: "Bilet",
    oxirgiNatija: "Oxirgi natija",
  },

  pricing: {
    eyebrow: "Tariflar",
    heading: "O'zingizga mos rejani tanlang",
    desc: "Barcha tariflarda to'liq savollar bazasi mavjud. Farqi — qo'shimcha video darslar va muddatda.",
    somLabel: "so'm",
    ommabop: "Ommabop",
    tanlash: "Tanlash",
    plans: [
      {
        name: "Standart",
        price: "300 000",
        periodLabel: "14 kun uchun",
        desc: "Asosiy tayyorgarlik uchun",
        features: ["63 ta bilet", "1 260 ta savol", "Mavzuli testlar", "Xatolar ustida ishlash"],
      },
      {
        name: "Pro",
        price: "900 000",
        periodLabel: "30 kun uchun",
        desc: "Eng ko'p tanlanadigan tarif",
        features: [
          "63 ta bilet",
          "1 260 ta savol",
          "Video darslar",
          "7 kunlik nazorat dasturi",
          "Yakuniy ichki imtihon",
        ],
      },
      {
        name: "Max",
        price: "1 500 000",
        periodLabel: "30 kun uchun",
        desc: "To'liq imkoniyatlar bilan",
        features: [
          "Pro tarifidagi barchasi",
          "Mnemonika video darslari",
          "Cheklanmagan qayta urinish",
          "Ustuvor qo'llab-quvvatlash",
        ],
      },
    ],
  },

  testimonials: {
    eyebrow: "Fikrlar",
    heading: "Bizning o'quvchilarimiz nima deydi",
    reviews: [
      {
        name: "Jasur Rahimov",
        role: "1-urinishda topshirdi",
        text: "63 ta biletni tizimli o'rganib, imtihonni birinchi urinishdayoq muvaffaqiyatli topshirdim. Xatolar ustida ishlash bo'limi juda yordam berdi.",
      },
      {
        name: "Madina Yusupova",
        role: "Pro tarif",
        text: "Video darslar tufayli chorrahalardagi qoidalarni oxiri tushunib yetdim. 7 kunlik dastur juda qulay tuzilgan.",
      },
      {
        name: "Aziz Karimov",
        role: "Standart tarif",
        text: "Avvalgi urinishda yiqilgan edim, bu safar mavzular bo'yicha testlarni qayta-qayta ishlab, ishonch bilan topshirdim.",
      },
    ],
  },

  finalCta: {
    heading: "Bugundan boshlab, tizimli tayyorlaning",
    desc: "63 ta bilet, 1 260 ta savol va 7 kunlik nazorat dasturi — hoziroq ro'yxatdan o'ting va tayyorgarlikni bugun boshlang.",
    cta: "Tayyorlanishni boshlash",
  },

  footer: {
    tagline: "Onlayn haydovchilik imtihoniga tayyorgarlik platformasi",
    copyright: "© 2026 PravaTayyor. Barcha huquqlar himoyalangan.",
  },

  registerModal: {
    qadam: (current, total) => `${current}-qadam / ${total}`,
    yopish: "Yopish",
    offer: {
      title: "Ommaviy oferta shartlari",
      checkbox: "Men ommaviy oferta shartlari bilan tanishdim va roziman",
      cta: "Davom etish",
    },
    status: {
      title: "Holatingizni tanlang",
      ariaLabel: "Imtihon holati",
      cta: "Davom etish",
    },
    form: {
      title: "Ro'yxatdan o'tish",
      firstName: "Ism",
      firstNamePlaceholder: "Aziz",
      lastName: "Familiya",
      lastNamePlaceholder: "Karimov",
      age: "Yosh",
      agePlaceholder: "18",
      phone: "Telefon raqam",
      phonePlaceholder: "+998 90 123 45 67",
      cta: "Davom etish",
      errors: {
        firstNameRequired: "Ism kiritilishi shart",
        firstNameInvalid: "Ism faqat harflardan iborat bo'lishi kerak",
        lastNameRequired: "Familiya kiritilishi shart",
        lastNameInvalid: "Familiya faqat harflardan iborat bo'lishi kerak",
        ageInvalid: "Yoshni raqamda kiriting",
        ageRange: "Yosh 16 dan 90 gacha bo'lishi kerak",
        phoneIncomplete: "Telefon raqam to'liq emas (+998 XX XXX XX XX)",
      },
    },
    otp: {
      title: "Telefonni tasdiqlash",
      subtitle: (phone) => `Sizga SMS-kod yuborildi${phone ? ` (${phone})` : ""}`,
      label: "Tasdiqlash kodi",
      placeholder: "Kodni kiriting",
      cta: "Tasdiqlash",
      errorInvalid: "Kod noto'g'ri",
    },
    success: {
      title: "Muvaffaqiyatli yakunlandi",
      desc: "Ro'yxatdan o'tish yakunlandi (demo rejim).",
    },
  },

  theme: { toLight: "Kunduzgi rejimga oʻtish", toDark: "Tungi rejimga oʻtish" },

  kabinet: {
    header: {
      active: "Faol",
      logout: "Chiqish",
      language: "Til",
      category: {
        "first-time": "Birinchi marta",
        "failed-before": "Ilgari yiqilgan",
        "license-revoked": "Pravasi bekor qilingan",
      },
    },
    loadError: {
      title: "Maʼlumotlarni yuklab boʻlmadi",
      desc: "Internet aloqasini tekshirib, qayta urinib koʻring.",
      retry: "Qayta urinish",
    },
    trial: { badge: "Yangi", title: (topicTitle) => `Sinov: ${topicTitle}` },
    ready: {
      title: "Imtihonga tayyorsiz!",
      desc: "Barcha 6 kunlik dastur muvaffaqiyatli tugatildi. Endi 7-kun yakuniy ichki imtihoniga oʻtishingiz mumkin.",
    },
    continueCard: {
      eyebrow: "Davom ettirish",
      location: (day, testNo) => `${day}-kun · ${testNo}-test`,
      stages: {
        video: "Video darsni koʻring",
        pdf: "Kalit soʻzlarni oʻqing",
        test: "Testni topshiring",
      },
      retryTest: (percent) => `Testni qayta ishlang — oxirgi natija ${percent}%`,
      cta: "Davom ettirish",
    },
    overall: {
      eyebrow: "Umumiy progress",
      ariaLabel: "Tugatilgan mavzular foizi",
      completedTopics: "Tugatilgan mavzular",
      completedDays: "Tugatilgan kunlar",
    },
    curriculum: {
      eyebrow: "Oʻquv dasturi",
      dayTitle: (day) => `${day}-kun`,
      dayQuestions: (count) => `${num(count)} ta savol`,
      dayProgressAria: (day) => `${day}-kun progressi`,
      status: { completed: "Tugagan", current: "Joriy", locked: "Qulflangan" },
    },
    topic: {
      testNo: (testNo) => `${testNo}-test`,
      questions: (count) => `${num(count)} ta savol`,
      notStarted: "Boshlanmagan",
      lockedHint: (percent) => `Avvalgi mavzu testidan kamida ${percent}% oling`,
    },
    finalExam: {
      badge: "7-kun",
      title: "Yakuniy ichki imtihon",
      pool: (count) => `${num(count)} ta savollar bazasi`,
      format: (questions, minutes) => `${questions} savol · ${minutes} daqiqa`,
      attempts: (used, max) => `Urinishlar: ${used}/${max}`,
      open: "Ochiq",
      locked: "Qulflangan",
      lockedHint: "1–6-kunlarning barcha mavzularini tugating",
    },
    randomTest: {
      title: "Tasodifiy test",
      questionsUnit: "savol",
      note: "Natijalar oʻquv progressiga taʼsir qilmaydi.",
      pageTitle: (size) => `${size} talik tasodifiy test`,
      pageTitleNoSize: "Tasodifiy test",
      soon: "Bu sahifa tez orada ishga tushadi. Natijalar oʻquv progressiga taʼsir qilmaydi.",
    },
    device: {
      detecting: "Aniqlanmoqda...",
      tablet: "Planshet",
      mobile: "Mobil telefon",
      desktop: "Kompyuter",
      current: "Joriy qurilma · hozir faol",
      singleDevice: "Bir vaqtda faqat bitta qurilmada kirish mumkin.",
    },
    topicPage: {
      soon: "Video dars, kalit soʻzlar va mavzu testi sahifasi tez orada ishga tushadi.",
    },
    backToKabinet: "Kabinetga qaytish",
  },

  testSession: {
    loading: "Yuklanmoqda...",
    loadError: "Savollarni yuklab boʻlmadi. Qayta urinib koʻring.",
    checkError: "Javobni tekshirib boʻlmadi. Qayta urinib koʻring.",
    solved: (current, total) => `Yechilgan: ${current} / ${total}`,
    finishTest: "Testni yakunlash",
    finishConfirm: (unanswered) => `${unanswered} ta savolga javob berilmagan. Testni yakunlaysizmi?`,
    finishConfirmYes: "Ha, yakunlash",
    cancel: "Bekor qilish",
    timeLeft: "Qolgan vaqt",
    timeRunningOut: "Vaqt tugayapti!",
    timeUp: "Vaqt tugadi!",
    redirecting: (seconds) => `${seconds} soniyadan soʻng kabinetga oʻtasiz`,
    goToKabinet: "Kabinetga oʻtish",
    keyboardHint: (count) => `Javob tanlash: F1–F${count} yoki 1–${count}`,
    resultTitle: "Natija",
    resultScore: (correct, total, percent) => `${correct} / ${total} toʻgʻri (${percent}%)`,
    restart: "Qayta boshlash",
    keyword: "Kalit soʻz:",
    showHint: "Izohni koʻrish",
    hideHint: "Izohni yashirish",
    prev: "Oldingi",
    next: "Keyingi savol",
    imageAlt: "Savol rasmi",
    questionAria: (index, state) =>
      `${index}-savol${
        state === "correct"
          ? ", toʻgʻri javob berilgan"
          : state === "incorrect"
            ? ", notoʻgʻri javob berilgan"
            : ""
      }`,
  },
};
