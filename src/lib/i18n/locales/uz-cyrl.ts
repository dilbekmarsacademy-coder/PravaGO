import type { Dictionary } from "../dictionary";
import { formatNumber } from "../localized";

const num = (value: number) => formatNumber(value, "uz-cyrl");

export const uzCyrl: Dictionary = {
  meta: {
    title: "PravaTayyor — Ҳайдовчилик имтиҳонига тайёргарлик",
    description:
      "Республика миқёсидаги онлайн ҳайдовчилик (права) имтиҳонига тайёргарлик платформаси.",
  },

  header: {
    brand: "PravaTayyor",
    nav: {
      boshSahifa: "Бош саҳифа",
      dastur: "Дастур",
      qandayIshlaydi: "Қандай ишлайди",
      natijalar: "Натижалар",
      narxlar: "Нархлар",
      bizHaqimizda: "Биз ҳақимизда",
    },
    kirish: "Кириш",
    tezOrada: "Тез орада",
    royxatdanOtish: "Рўйхатдан ўтиш",
    menyuniOchish: "Менюни очиш",
    menyuniYopish: "Менюни ёпиш",
  },

  hero: {
    badge: "Революцион ҳайдовчилик платформаси",
    titlePre: "Права имтиҳонини ",
    titleHighlight: "1-уринишдаёқ",
    titlePost: " топширинг!",
    subtitle:
      "63 та билет, 1 260 та интерактив савол ва 7 кунлик автотест симуляцияси — тизимли тайёргарлик учун барчаси битта жойда.",
    ctaPrimary: "Тайёрланишни бошлаш",
    ctaSecondary: "Қандай ишлашини кўриш",
    note: "Рўйхатдан ўтиш 1 дақиқадан кам вақт олади",
  },

  trustStats: {
    items: [
      { value: "63", unit: "БИЛЕТ", desc: "Тўлиқ янгиланган базаси" },
      { value: "1 260", unit: "САВОЛ", desc: "Расмий ЙҲХББ имтиҳон базаси" },
      { value: "6+1", unit: "КУН", desc: "Босқичма-босқич тезлаштирилган тизим" },
      { value: "98%", unit: "PASSRATE", desc: "Кейинги босқичга ўтиш талаби" },
    ],
  },

  examStatusOptions: [
    {
      value: "first-time",
      title: "Биринчи марта топшираман",
      desc: "Ҳали имтиҳонга кирмаганман.",
    },
    {
      value: "failed-before",
      title: "Олдин имтиҳондан йиқилганман",
      desc: "Қайта тайёрланмоқчиман.",
    },
    {
      value: "license-revoked",
      title: "Гувоҳномам бекор қилинган",
      desc: "Қайта имтиҳонга тайёрланяпман.",
    },
  ],

  categorySection: {
    heading: "Сиз қайси ҳолатдасиз?",
    cta: "Мен учун",
  },

  howItWorks: {
    eyebrow: "Race track",
    heading: "7 кунда тайёргарлик тизими",
    steps: [
      { title: "Видео дарсни кўринг", desc: "Мавзу бўйича қисқа видео дарс" },
      { title: "Мавзу тестини ишланг", desc: "Билимни тестда мустаҳкамланг" },
      { title: "98% натижага етинг", desc: "Талаб қилинган натижага чиқинг" },
      { title: "Кейинги мавзуни очинг", desc: "Дастур автоматик давом этади" },
      { title: "7-кун якуний имтиҳон", desc: "Якуний назорат имтиҳонини топширинг" },
    ],
  },

  productPreview: {
    eyebrow: "Платформа",
    heading: "Ҳамма нарса бир жойда",
    desc: "Видео дарсдан тортиб якуний ички имтиҳонгача — бутун тайёргарлик жараёни битта шахсий кабинетда, аниқ босқичлар билан бошқарилади.",
    checklist: [
      "Мавзули видео дарслар",
      "1 260 та расмий савол",
      "Автоматик натижа назорати",
      "Қайта ишлаш имконияти",
      "Якуний ички имтиҳон",
    ],
    cta: "Тайёрланишни бошлаш",
    shaxsiyKabinet: "Шахсий кабинет",
    online: "ONLINE",
    kun: "кун",
    bugungiVazifa: "Бугунги вазифа",
    vazifaTitle: "5-мавзу: Чорраҳаларда ҳаракатланиш",
    vazifaDesc: "Видео дарс + 20 саволлик тест",
    bilet: "Билет",
    oxirgiNatija: "Охирги натижа",
  },

  pricing: {
    eyebrow: "Тарифлар",
    heading: "Ўзингизга мос режани танланг",
    desc: "Барча тарифларда тўлиқ саволлар базаси мавжуд. Фарқи — қўшимча видео дарслар ва муддатда.",
    somLabel: "сўм",
    ommabop: "Оммабоп",
    tanlash: "Танлаш",
    plans: [
      {
        name: "Стандарт",
        price: "300 000",
        periodLabel: "14 кун учун",
        desc: "Асосий тайёргарлик учун",
        features: ["63 та билет", "1 260 та савол", "Мавзули тестлар", "Хатолар устида ишлаш"],
      },
      {
        name: "Про",
        price: "900 000",
        periodLabel: "30 кун учун",
        desc: "Энг кўп танланадиган тариф",
        features: [
          "63 та билет",
          "1 260 та савол",
          "Видео дарслар",
          "7 кунлик назорат дастури",
          "Якуний ички имтиҳон",
        ],
      },
      {
        name: "Макс",
        price: "1 500 000",
        periodLabel: "30 кун учун",
        desc: "Тўлиқ имкониятлар билан",
        features: [
          "Про тарифидаги барчаси",
          "Мнемоника видео дарслари",
          "Чекланмаган қайта уриниш",
          "Устувор қўллаб-қувватлаш",
        ],
      },
    ],
  },

  testimonials: {
    eyebrow: "Фикрлар",
    heading: "Бизнинг ўқувчиларимиз нима дейди",
    reviews: [
      {
        name: "Жасур Раҳимов",
        role: "1-уринишда топширди",
        text: "63 та билетни тизимли ўрганиб, имтиҳонни биринчи уринишдаёқ муваффақиятли топширдим. Хатолар устида ишлаш бўлими жуда ёрдам берди.",
      },
      {
        name: "Мадина Юсупова",
        role: "Про тариф",
        text: "Видео дарслар туфайли чорраҳалардаги қоидаларни охири тушуниб етдим. 7 кунлик дастур жуда қулай тузилган.",
      },
      {
        name: "Азиз Каримов",
        role: "Стандарт тариф",
        text: "Аввалги уринишда йиқилган эдим, бу сафар мавзулар бўйича тестларни қайта-қайта ишлаб, ишонч билан топширдим.",
      },
    ],
  },

  finalCta: {
    heading: "Бугундан бошлаб, тизимли тайёрланинг",
    desc: "63 та билет, 1 260 та савол ва 7 кунлик назорат дастури — ҳозироқ рўйхатдан ўтинг ва тайёргарликни бугун бошланг.",
    cta: "Тайёрланишни бошлаш",
  },

  footer: {
    tagline: "Онлайн ҳайдовчилик имтиҳонига тайёргарлик платформаси",
    copyright: "© 2026 PravaTayyor. Барча ҳуқуқлар ҳимояланган.",
  },

  registerModal: {
    qadam: (current, total) => `${current}-қадам / ${total}`,
    yopish: "Ёпиш",
    offer: {
      title: "Оммавий оферта шартлари",
      checkbox: "Мен оммавий оферта шартлари билан танишдим ва розиман",
      cta: "Давом этиш",
    },
    status: {
      title: "Ҳолатингизни танланг",
      ariaLabel: "Имтиҳон ҳолати",
      cta: "Давом этиш",
    },
    form: {
      title: "Рўйхатдан ўтиш",
      firstName: "Исм",
      firstNamePlaceholder: "Азиз",
      lastName: "Фамилия",
      lastNamePlaceholder: "Каримов",
      age: "Ёш",
      agePlaceholder: "18",
      phone: "Телефон рақам",
      phonePlaceholder: "+998 90 123 45 67",
      cta: "Давом этиш",
      errors: {
        firstNameRequired: "Исм киритилиши шарт",
        firstNameInvalid: "Исм фақат ҳарфлардан иборат бўлиши керак",
        lastNameRequired: "Фамилия киритилиши шарт",
        lastNameInvalid: "Фамилия фақат ҳарфлардан иборат бўлиши керак",
        ageInvalid: "Ёшни рақамда киритинг",
        ageRange: "Ёш 16 дан 90 гача бўлиши керак",
        phoneIncomplete: "Телефон рақам тўлиқ эмас (+998 XX XXX XX XX)",
      },
    },
    otp: {
      title: "Телефонни тасдиқлаш",
      subtitle: (phone) => `Сизга СМС-код юборилди${phone ? ` (${phone})` : ""}`,
      label: "Тасдиқлаш коди",
      placeholder: "Кодни киритинг",
      cta: "Тасдиқлаш",
      errorInvalid: "Код нотўғри",
    },
    success: {
      title: "Муваффақиятли якунланди",
      desc: "Рўйхатдан ўтиш якунланди (демо режим).",
    },
  },

  kabinet: {
    header: {
      active: "Фаол",
      logout: "Чиқиш",
      language: "Тил",
      category: {
        "first-time": "Биринчи марта",
        "failed-before": "Илгари йиқилган",
        "license-revoked": "Праваси бекор қилинган",
      },
    },
    loadError: {
      title: "Маълумотларни юклаб бўлмади",
      desc: "Интернет алоқасини текшириб, қайта уриниб кўринг.",
      retry: "Қайта уриниш",
    },
    trial: { badge: "Янги", title: (topicTitle) => `Синов: ${topicTitle}` },
    ready: {
      title: "Имтиҳонга тайёрсиз!",
      desc: "Барча 6 кунлик дастур муваффақиятли тугатилди. Энди 7-кун якуний ички имтиҳонига ўтишингиз мумкин.",
    },
    continueCard: {
      eyebrow: "Давом эттириш",
      location: (day, testNo) => `${day}-кун · ${testNo}-тест`,
      stages: {
        video: "Видео дарсни кўринг",
        pdf: "Калит сўзларни ўқинг",
        test: "Тестни топширинг",
      },
      retryTest: (percent) => `Тестни қайта ишланг — охирги натижа ${percent}%`,
      cta: "Давом эттириш",
    },
    overall: {
      eyebrow: "Умумий прогресс",
      ariaLabel: "Тугатилган мавзулар фоизи",
      completedTopics: "Тугатилган мавзулар",
      completedDays: "Тугатилган кунлар",
    },
    curriculum: {
      eyebrow: "Ўқув дастури",
      dayTitle: (day) => `${day}-кун`,
      dayQuestions: (count) => `${num(count)} та савол`,
      dayProgressAria: (day) => `${day}-кун прогресси`,
      status: { completed: "Тугаган", current: "Жорий", locked: "Қулфланган" },
    },
    topic: {
      testNo: (testNo) => `${testNo}-тест`,
      questions: (count) => `${num(count)} та савол`,
      notStarted: "Бошланмаган",
      lockedHint: (percent) => `Аввалги мавзу тестидан камида ${percent}% олинг`,
    },
    finalExam: {
      badge: "7-кун",
      title: "Якуний ички имтиҳон",
      pool: (count) => `${num(count)} та саволлар базаси`,
      format: (questions, minutes) => `${questions} савол · ${minutes} дақиқа`,
      attempts: (used, max) => `Уринишлар: ${used}/${max}`,
      open: "Очиқ",
      locked: "Қулфланган",
      lockedHint: "1–6-кунларнинг барча мавзуларини тугатинг",
    },
    randomTest: {
      title: "Тасодифий тест",
      questionsUnit: "савол",
      note: "Натижалар ўқув прогрессига таъсир қилмайди.",
      pageTitle: (size) => `${size} талик тасодифий тест`,
      pageTitleNoSize: "Тасодифий тест",
      soon: "Бу саҳифа тез орада ишга тушади. Натижалар ўқув прогрессига таъсир қилмайди.",
    },
    device: {
      detecting: "Аниқланмоқда...",
      tablet: "Планшет",
      mobile: "Мобил телефон",
      desktop: "Компьютер",
      current: "Жорий қурилма · ҳозир фаол",
      singleDevice: "Бир вақтда фақат битта қурилмада кириш мумкин.",
    },
    topicPage: {
      soon: "Видео дарс, калит сўзлар ва мавзу тести саҳифаси тез орада ишга тушади.",
    },
    backToKabinet: "Кабинетга қайтиш",
  },

  testSession: {
    loading: "Юкланмоқда...",
    loadError: "Саволларни юклаб бўлмади. Қайта уриниб кўринг.",
    checkError: "Жавобни текшириб бўлмади. Қайта уриниб кўринг.",
    solved: (current, total) => `Ечилган: ${current} / ${total}`,
    finishTest: "Тестни якунлаш",
    finishConfirm: (unanswered) => `${unanswered} та саволга жавоб берилмаган. Тестни якунлайсизми?`,
    finishConfirmYes: "Ҳа, якунлаш",
    cancel: "Бекор қилиш",
    elapsed: "Ўтган вақт",
    keyboardHint: (count) => `Жавоб танлаш: F1–F${count} ёки 1–${count}`,
    resultTitle: "Натижа",
    resultScore: (correct, total, percent) => `${correct} / ${total} тўғри (${percent}%)`,
    restart: "Қайта бошлаш",
    keyword: "Калит сўз:",
    showHint: "Изоҳни кўриш",
    hideHint: "Изоҳни яшириш",
    prev: "Олдинги",
    next: "Кейинги савол",
    imageAlt: "Савол расми",
    questionAria: (index, state) =>
      `${index}-савол${
        state === "correct"
          ? ", тўғри жавоб берилган"
          : state === "incorrect"
            ? ", нотўғри жавоб берилган"
            : ""
      }`,
  },
};
