import type { ExamStatus } from "@/components/home/types";

export type Locale = "uz-latn" | "uz-cyrl" | "ru";

export const LOCALE_META: { value: Locale; label: string; nativeName: string }[] = [
  { value: "uz-latn", label: "UZ", nativeName: "Oʻzbekcha" },
  { value: "uz-cyrl", label: "ЎЗ", nativeName: "Ўзбекча" },
  { value: "ru", label: "RU", nativeName: "Русский" },
];

export const DEFAULT_LOCALE: Locale = "uz-latn";

export interface Dictionary {
  meta: { title: string; description: string };

  header: {
    brand: string;
    nav: {
      boshSahifa: string;
      dastur: string;
      qandayIshlaydi: string;
      afzalliklar: string;
      narxlar: string;
      bizHaqimizda: string;
    };
    kirish: string;
    tezOrada: string;
    royxatdanOtish: string;
    menyuniOchish: string;
    menyuniYopish: string;
  };

  hero: {
    badge: string;
    titlePre: string;
    titleHighlight: string;
    titlePost: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    note: string;
  };

  trustStats: {
    items: { value: string; unit: string; desc: string }[];
  };

  examStatusOptions: { value: ExamStatus; title: string; desc: string }[];

  categorySection: {
    heading: string;
    cta: string;
  };

  howItWorks: {
    eyebrow: string;
    heading: string;
    steps: { title: string; desc: string }[];
  };

  productPreview: {
    eyebrow: string;
    heading: string;
    desc: string;
    checklist: string[];
    cta: string;
    shaxsiyKabinet: string;
    online: string;
    kun: string;
    bugungiVazifa: string;
    vazifaTitle: string;
    vazifaDesc: string;
    bilet: string;
    oxirgiNatija: string;
    /** Maketdagi raqam namuna ekanini bildiruvchi belgi. */
    namuna: string;
  };

  pricing: {
    eyebrow: string;
    heading: string;
    desc: string;
    somLabel: string;
    ommabop: string;
    tanlash: string;
    /** Muddat almashtirgich: 7 → "1 hafta", 30 → "1 oy". */
    durationLabel: (days: number) => string;
    /** "14 kun uchun" */
    period: (days: number) => string;
    /** Premium/Mentor muddati: "Imtihondan o'tguncha". */
    untilPassed: string;
    trialNote: (days: number) => string;
    /** /tariflar havolasi */
    details: string;
    /** Narx va muddat — src/config/tariffs.ts; tartib TARIFFS bilan bir xil. */
    plans: {
      name: string;
      desc: string;
      /** "Standartdagi hamma narsa +" yoki null. */
      inherits: string | null;
      features: string[];
    }[];
  };

  testimonials: {
    eyebrow: string;
    heading: string;
    reviews: { name: string; role: string; text: string }[];
  };

  finalCta: {
    heading: string;
    desc: string;
    cta: string;
  };

  /** Eski manzildagi "Sayt ko'chdi" sahifasi. */
  moved: {
    eyebrow: string;
    /** Domen (pravaishonch.uz) alohida qatorda ko'rsatiladi. */
    titlePre: string;
    body: string;
    button: string;
    countdown: (seconds: number) => string;
    signedIn: string;
  };
  /** Yangi manzildagi avtomatik kirish (/auth/transfer). */
  transfer: {
    loading: string;
    failed: string;
  };

  footer: {
    tagline: string;
    copyright: string;
    /** "Biz haqimizda": brend nomi ikkala shaklda (PravaIshonch / Prava Ishonch). */
    about: string;
    /** Ommaviy sahifalar (/tariflar, /oferta, /qaytarish, /maxfiylik, /aloqa). */
    links: { tariffs: string; offer: string; refund: string; privacy: string; contact: string };
    contactsTitle: string;
    legalTitle: string;
    workingHours: string;
    stir: string;
  };

  registerModal: {
    qadam: (current: number, total: number) => string;
    yopish: string;
    offer: {
      title: string;
      intro: string;
      rules: string[];
      /** Rozilik: "{pre}<oferta>{mid}<maxfiylik siyosati>{post}" — havolalar /oferta va /maxfiylik. */
      consent: { pre: string; offer: string; mid: string; privacy: string; post: string };
      cta: string;
    };
    status: {
      title: string;
      ariaLabel: string;
      cta: string;
    };
    form: {
      title: string;
      firstName: string;
      firstNamePlaceholder: string;
      lastName: string;
      lastNamePlaceholder: string;
      age: string;
      agePlaceholder: string;
      phone: string;
      phonePlaceholder: string;
      cta: string;
      errors: {
        firstNameRequired: string;
        firstNameInvalid: string;
        lastNameRequired: string;
        lastNameInvalid: string;
        ageInvalid: string;
        ageRange: string;
        phoneIncomplete: string;
        phoneTaken: string;
        serverError: string;
      };
    };
    otp: {
      title: string;
      subtitle: (phone: string) => string;
      label: string;
      placeholder: string;
      cta: string;
      errorInvalid: string;
    };
    success: {
      title: string;
      desc: string;
    };
  };

  theme: { toLight: string; toDark: string };

  kabinet: {
    header: {
      active: string;
      logout: string;
      language: string;
      menu: string;
      category: Record<ExamStatus, string>;
    };
    loadError: { title: string; desc: string; retry: string };
    ready: { title: string; desc: string };
    continueCard: {
      eyebrow: string;
      location: (day: number, order: number) => string;
      stages: { video: string; pdf: string; test: string };
      retryTest: (percent: number) => string;
      cta: string;
    };
    overall: {
      eyebrow: string;
      ariaLabel: string;
      completedTopics: string;
      completedDays: string;
    };
    curriculum: {
      eyebrow: string;
      dayTitle: (day: number) => string;
      dayQuestions: (count: number) => string;
      dayProgressAria: (day: number) => string;
      status: { completed: string; current: string; locked: string; firstTopicOpen: string };
    };
    topic: {
      testNo: (testNo: number) => string;
      questions: (count: number) => string;
      notStarted: string;
      order: (order: number) => string;
      comingSoon: string;
      videoWatched: string;
      videoPercent: (percent: number) => string;
      videoSoon: string;
      lockedHint: (percent: number) => string;
    };
    finalExam: {
      badge: string;
      title: string;
      pool: (count: number) => string;
      format: (questions: number, minutes: number) => string;
      attempts: (used: number, max: number) => string;
      open: string;
      locked: string;
      lockedHint: string;
    };
    newTests: {
      title: string;
      desc: string;
      questions: (n: number) => string;
      best: (percent: number) => string;
      notStarted: string;
      empty: string;
      tests: (n: number) => string;
      passedOf: (passed: number, total: number) => string;
      back: string;
      groupEmpty: string;
    };
    insight: {
      title: string;
      desc: string;
      noAttempts: string;
      generate: string;
      refresh: string;
      nextAt: (time: string) => string;
      upToDate: string;
      topicsPassed: (passed: number, total: number) => string;
      average: string;
      recent: string;
      accuracy: string;
      weak: string;
      strong: string;
      mostWrong: (n: number) => string;
      tips: string;
      updated: (date: string) => string;
      aiOff: string;
      error: string;
      privacy: string;
    };
    randomTest: {
      title: string;
      questionsUnit: string;
      note: string;
      minutes: (n: number) => string;
      pageTitle: (size: number) => string;
      pageTitleNoSize: string;
      intro: string;
      start: string;
      starting: string;
      cancel: string;
      confirmTitle: (size: number) => string;
      confirmDesc: (size: number) => string;
      notEnoughTitle: string;
      notEnoughDesc: (available: number, size: number) => string;
      startWithAvailable: (n: number) => string;
      noQuestions: string;
      activeTitle: string;
      activeDesc: (answered: number, total: number) => string;
      activeBlocks: string;
      continue: string;
      finishActive: string;
      historyTitle: string;
      historyEmpty: string;
      status: { finished: string; expired: string; in_progress: string };
      open: string;
      loadError: string;
      retry: string;
      sessionTitle: (total: number) => string;
      timeUp: string;
      reviewTitle: string;
      filterAll: string;
      filterWrong: string;
      filterUnanswered: string;
      filterEmpty: string;
      showMore: string;
      newTest: string;
      notAnswered: string;
      answerTimeUp: string;
    };
    device: {
      detecting: string;
      tablet: string;
      mobile: string;
      desktop: string;
      current: string;
      singleDevice: string;
    };
    topicPage: { soon: string; dayTopic: (day: number, order: number) => string };
    backToKabinet: string;
  };

  testSession: {
    loading: string;
    loadError: string;
    checkError: string;
    solved: (current: number, total: number) => string;
    questionOf: (index: number, total: number) => string;
    questionNumber: (index: number) => string;
    imageOnlyQuestion: string;
    finishTest: string;
    finishShort: string;
    continueTest: string;
    finishModalTitle: string;
    finishModalUnanswered: (unanswered: number) => string;
    finishModalAllAnswered: string;
    finishModalRemaining: string;
    finishModalResult: string;
    finishModalResultValue: (correct: number, total: number, percent: number) => string;
    finishConfirm: string;
    /** Javobni tasdiqlash paneli (tasodifan bosib yuborishdan himoya). */
    /** Javobni tasdiqlash oynasi: sarlavha, savol (variant belgisi va to'liq matni alohida ko'rsatiladi). */
    confirmAnswerTitle: string;
    confirmAnswerQuestion: string;
    confirmAnswerYes: string;
    confirmAnswerNo: string;
    nextTopic: string;
    nextDay: string;
    completeTitle: string;
    dayCompleteTitle: (day: number) => string;
    completeResult: (correct: number, total: number, percent: number) => string;
    notPassedTitle: string;
    notPassedDesc: (passPercent: number) => string;
    viewResults: string;
    timeLeft: string;
    timeRunningOut: string;
    timeUp: string;
    redirecting: (seconds: number) => string;
    goToKabinet: string;
    kbdAnswer: string;
    kbdOr: string;
    kbdQuestions: string;
    resultTitle: string;
    resultScore: (correct: number, total: number, percent: number) => string;
    passed: string;
    failed: string;
    passRule: (percent: number) => string;
    examPassRule: (needed: number, total: number) => string;
    correctLabel: string;
    wrongLabel: string;
    unansweredLabel: string;
    timeSpent: string;
    wrongListTitle: string;
    noWrong: string;
    yourAnswer: string;
    correctAnswer: string;
    retryWrong: string;
    restart: string;
    keyword: string;
    showHint: string;
    hideHint: string;
    videoLesson: string;
    bookmark: string;
    unbookmark: string;
    zoomImage: string;
    closeImage: string;
    moreActions: string;
    openNavigator: string;
    navigatorTitle: string;
    close: string;
    prev: string;
    next: string;
    imageAlt: string;
    questionAria: (index: number, state: "correct" | "incorrect" | "answered" | null, bookmarked: boolean) => string;
    kbdSave: string;
  };

  /** Video dars: player va testni qulflash ekrani. Matnlarda video manbai tilga olinmaydi. */
  lesson: {
    videoLabel: string;
    player: {
      play: string;
      pause: string;
      mute: string;
      unmute: string;
      volume: string;
      speed: string;
      fullscreen: string;
      exitFullscreen: string;
      timeline: string;
      seekLocked: string;
      loading: string;
      errorTitle: string;
      errorDesc: string;
      retry: string;
      start: string;
      resume: (time: string) => string;
      tapAgain: string;
      paused: string;
      replay: string;
      watched: string;
      keyboardHint: string;
      /** Skrinshot/ekran yozish urinishida video ustidagi qalqon matni. */
      protected: string;
      /** VAQTINCHA: sinov uchun oldinga o'tkazish tugmalari (NEXT_PUBLIC_LESSON_SKIP). */
      skipForward: string;
      skipToEnd: string;
      /** "10 soniya orqaga" tugmasi. */
      seekBack: string;
      /** Tugash ekrani sarlavhasi. */
      ended: string;
      /** Qalqondan (fokus yo'qotish, skrinshot) keyin ijroni qaytarish. */
      continue: string;
      /** Oyna fokusni yo'qotganda qalqon matni. */
      away: string;
      /** Dasturchi vositalari ochilganda (pauza qilinadi). */
      devtools: string;
      /** Darsga hali video ulanmagan. */
      notReadyTitle: string;
      notReadyDesc: string;
    };
    gate: {
      lockedTitle: string;
      progress: (percent: number) => string;
      unlocked: string;
      /** Video ko'rildi, test esa savollar bilan tanishilgach ochiladi. */
      videoDone: string;
      keywordsTitle: string;
      keywordsProgress: (done: number, total: number) => string;
      keywordsButton: string;
      testLockedHint: string;
      testUnlocked: string;
      startTest: string;
      checking: string;
      /** Test sahifasi hali ulanmagan — modal. */
      soonTitle: string;
      soonDesc: string;
      close: string;
    };
  };

  saved: {
    title: string;
    total: (count: number) => string;
    /** Kabinet header'idagi ikonka uchun. */
    headerAria: (count: number) => string;
    toast: {
      saved: string;
      removed: string;
      view: string;
      undo: string;
      error: string;
      limit: (limit: number) => string;
      dismiss: string;
    };
    card: {
      eyebrow: string;
      desc: (count: number) => string;
      empty: string;
      viewAll: string;
    };
    page: {
      searchLabel: string;
      searchPlaceholder: string;
      topicLabel: string;
      allTopics: string;
      sortLabel: string;
      sortNew: string;
      sortOld: string;
      modeLabel: string;
      modeView: string;
      modeReview: string;
      filtersTitle: string;
      practice: string;
      practiceTopic: string;
      practiceTitle: string;
      loadMore: string;
      loading: string;
      emptyTitle: string;
      emptyDesc: string;
      emptyCta: string;
      noResultsTitle: string;
      noResultsDesc: string;
      clearFilters: string;
      errorTitle: string;
      errorDesc: string;
      retry: string;
    };
    item: {
      /** Kun, kun ichidagi mavzu tartibi va savol tartibi. */
      location: (day: number, topicOrder: number, questionOrder: number) => string;
      questionNo: (order: number) => string;
      correctAnswer: string;
      keyword: string;
      locked: string;
      reviewHint: string;
      reviewCorrect: string;
      reviewWrong: string;
      reviewAgain: string;
      noteLabel: string;
      addNote: string;
      editNote: string;
      notePlaceholder: string;
      noteSaving: string;
      noteSaved: string;
      noteError: string;
      remove: string;
      video: string;
      sourceExam: string;
    };
    ago: {
      justNow: string;
      minutes: (n: number) => string;
      hours: (n: number) => string;
      days: (n: number) => string;
      months: (n: number) => string;
      years: (n: number) => string;
    };
  };

  /** Kalit so'zlar: test natijasi, "Saqlanganlar" va mavzudagi "Kalit so'zlar" bo'limi. */
  keywords: {
    /** Savolda kalit so'z umuman yo'q. */
    none: string;
    /** Chipning bitta qismi (savol yoki javob kaliti) yo'q. */
    partNone: string;
    questionKey: string;
    answerKey: string;
    open: string;
    openDesc: string;
    page: {
      eyebrow: string;
      title: string;
      progress: (done: number, total: number) => string;
      progressAria: string;
      searchLabel: string;
      searchPlaceholder: string;
      hideAnswers: string;
      tapToReveal: string;
      questionNo: (order: number) => string;
      correctAnswer: string;
      explanation: string;
      reviewed: string;
      markReviewed: (order: number) => string;
      /** Sahifa boshidagi tushuntirish: hammasi bilan tanishilgach test ochiladi. */
      intro: string;
      startLocked: (left: number) => string;
      allReviewed: string;
      reviewError: string;
      noResultsTitle: string;
      noResultsDesc: string;
      clearSearch: string;
      emptyTitle: string;
      emptyDesc: string;
      /** Mavzudagi birorta savolda kalit so'z yo'q. */
      topicNone: string;
      lockedTitle: string;
      lockedDesc: string;
      goToVideo: string;
      loadError: string;
      retry: string;
      startTest: string;
      backToTopic: string;
    };
  };

  /** "Men shu yerda o'qiyman" — o'quv markaz o'quvchisi kirishi. */
  centerLogin: {
    button: string;
    buttonHint: string;
    title: string;
    desc: string;
    phone: string;
    phonePlaceholder: string;
    login: string;
    loginPlaceholder: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    oneDeviceNote: string;
    submit: string;
    submitting: string;
    errors: {
      phoneIncomplete: string;
      required: string;
      invalid: string;
      rateLimited: string;
      inactive: string;
      network: string;
      server: string;
    };
    kicked: {
      replaced: string;
      revoked: string;
      inactive: string;
    };
    accessDisabled: { title: string; desc: string };
  };
}
