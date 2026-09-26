import type { Dictionary } from "../dictionary";
import { formatNumber } from "../localized";

const num = (value: number) => formatNumber(value, "ru");

/** Ruscha ko'plik: 1 вопрос, 2 вопроса, 5 вопросов. */
function questionWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "вопрос";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "вопроса";
  return "вопросов";
}

export const ru: Dictionary = {
  meta: {
    title: "PravaTayyor — Подготовка к экзамену на права",
    description:
      "Республиканская онлайн-платформа подготовки к экзамену на водительские права.",
  },

  header: {
    brand: "PravaTayyor",
    nav: {
      boshSahifa: "Главная",
      dastur: "Программа",
      qandayIshlaydi: "Как это работает",
      natijalar: "Результаты",
      narxlar: "Тарифы",
      bizHaqimizda: "О нас",
    },
    kirish: "Войти",
    tezOrada: "Скоро",
    royxatdanOtish: "Регистрация",
    menyuniOchish: "Открыть меню",
    menyuniYopish: "Закрыть меню",
  },

  hero: {
    badge: "Революционная платформа обучения вождению",
    titlePre: "Сдайте экзамен на права ",
    titleHighlight: "с первой попытки",
    titlePost: "!",
    subtitle:
      "63 билета, 1 260 интерактивных вопросов и 7-дневная симуляция автотеста — всё для системной подготовки в одном месте.",
    ctaPrimary: "Начать подготовку",
    ctaSecondary: "Посмотреть, как это работает",
    note: "Регистрация займёт менее 1 минуты",
  },

  trustStats: {
    items: [
      { value: "63", unit: "БИЛЕТ", desc: "Полностью обновлённая база" },
      { value: "1 260", unit: "ВОПРОС", desc: "Официальная база вопросов ПДД" },
      { value: "6+1", unit: "ДЕНЬ", desc: "Поэтапная ускоренная система" },
      { value: "98%", unit: "PASSRATE", desc: "Требование для перехода на следующий этап" },
    ],
  },

  examStatusOptions: [
    {
      value: "first-time",
      title: "Сдаю в первый раз",
      desc: "Ещё не сдавал(а) экзамен.",
    },
    {
      value: "failed-before",
      title: "Уже проваливал(а) экзамен",
      desc: "Хочу подготовиться заново.",
    },
    {
      value: "license-revoked",
      title: "Права аннулированы",
      desc: "Готовлюсь пересдавать экзамен.",
    },
  ],

  categorySection: {
    heading: "В какой вы ситуации?",
    cta: "Это про меня",
  },

  howItWorks: {
    eyebrow: "Race track",
    heading: "Система подготовки за 7 дней",
    steps: [
      { title: "Смотрите видеоурок", desc: "Короткий видеоурок по теме" },
      { title: "Проходите тест по теме", desc: "Закрепите знания тестом" },
      { title: "Достигните результата 98%", desc: "Выйдите на требуемый результат" },
      { title: "Открывайте следующую тему", desc: "Программа продолжается автоматически" },
      { title: "7-й день — финальный экзамен", desc: "Сдайте итоговый контрольный экзамен" },
    ],
  },

  productPreview: {
    eyebrow: "Платформа",
    heading: "Всё в одном месте",
    desc: "От видеоурока до финального внутреннего экзамена — весь процесс подготовки управляется в личном кабинете, с чёткими этапами.",
    checklist: [
      "Видеоуроки по темам",
      "1 260 официальных вопросов",
      "Автоматический контроль результатов",
      "Возможность пересдачи",
      "Финальный внутренний экзамен",
    ],
    cta: "Начать подготовку",
    shaxsiyKabinet: "Личный кабинет",
    online: "ONLINE",
    kun: "дней",
    bugungiVazifa: "Задание на сегодня",
    vazifaTitle: "Тема 5: Движение на перекрёстках",
    vazifaDesc: "Видеоурок + тест из 20 вопросов",
    bilet: "Билетов",
    oxirgiNatija: "Последний результат",
  },

  pricing: {
    eyebrow: "Тарифы",
    heading: "Выберите подходящий тариф",
    desc: "Во всех тарифах полная база вопросов. Разница — в дополнительных видеоуроках и сроке действия.",
    somLabel: "сум",
    ommabop: "Популярный",
    tanlash: "Выбрать",
    plans: [
      {
        name: "Стандарт",
        price: "300 000",
        periodLabel: "на 14 дней",
        desc: "Для базовой подготовки",
        features: ["63 билета", "1 260 вопросов", "Тесты по темам", "Работа над ошибками"],
      },
      {
        name: "Про",
        price: "900 000",
        periodLabel: "на 30 дней",
        desc: "Самый популярный тариф",
        features: [
          "63 билета",
          "1 260 вопросов",
          "Видеоуроки",
          "7-дневная контрольная программа",
          "Финальный внутренний экзамен",
        ],
      },
      {
        name: "Макс",
        price: "1 500 000",
        periodLabel: "на 30 дней",
        desc: "С полным набором возможностей",
        features: [
          "Всё из тарифа Про",
          "Видеоуроки по мнемонике",
          "Неограниченное количество попыток",
          "Приоритетная поддержка",
        ],
      },
    ],
  },

  testimonials: {
    eyebrow: "Отзывы",
    heading: "Что говорят наши ученики",
    reviews: [
      {
        name: "Жасур Рахимов",
        role: "Сдал с первой попытки",
        text: "Системно изучил все 63 билета и сдал экзамен с первой же попытки. Раздел «работа над ошибками» очень помог.",
      },
      {
        name: "Мадина Юсупова",
        role: "Тариф Про",
        text: "Благодаря видеоурокам наконец разобралась в правилах на перекрёстках. 7-дневная программа очень удобно выстроена.",
      },
      {
        name: "Азиз Каримов",
        role: "Тариф Стандарт",
        text: "В прошлый раз провалился, в этот раз снова и снова прорешал тесты по темам и сдал уверенно.",
      },
    ],
  },

  finalCta: {
    heading: "Начните готовиться системно уже сегодня",
    desc: "63 билета, 1 260 вопросов и 7-дневная контрольная программа — зарегистрируйтесь прямо сейчас и начните подготовку сегодня.",
    cta: "Начать подготовку",
  },

  footer: {
    tagline: "Онлайн-платформа подготовки к экзамену на водительские права",
    copyright: "© 2026 PravaTayyor. Все права защищены.",
  },

  registerModal: {
    qadam: (current, total) => `Шаг ${current} из ${total}`,
    yopish: "Закрыть",
    offer: {
      title: "Условия публичной оферты",
      checkbox: "Я ознакомился(-лась) с условиями публичной оферты и согласен(-на)",
      cta: "Продолжить",
    },
    status: {
      title: "Выберите вашу ситуацию",
      ariaLabel: "Статус экзамена",
      cta: "Продолжить",
    },
    form: {
      title: "Регистрация",
      firstName: "Имя",
      firstNamePlaceholder: "Азиз",
      lastName: "Фамилия",
      lastNamePlaceholder: "Каримов",
      age: "Возраст",
      agePlaceholder: "18",
      phone: "Номер телефона",
      phonePlaceholder: "+998 90 123 45 67",
      cta: "Продолжить",
      errors: {
        firstNameRequired: "Введите имя",
        firstNameInvalid: "Имя должно состоять только из букв",
        lastNameRequired: "Введите фамилию",
        lastNameInvalid: "Фамилия должна состоять только из букв",
        ageInvalid: "Введите возраст цифрами",
        ageRange: "Возраст должен быть от 16 до 90",
        phoneIncomplete: "Номер телефона указан не полностью (+998 XX XXX XX XX)",
      },
    },
    otp: {
      title: "Подтверждение телефона",
      subtitle: (phone) => `Вам отправлен SMS-код${phone ? ` (${phone})` : ""}`,
      label: "Код подтверждения",
      placeholder: "Введите код",
      cta: "Подтвердить",
      errorInvalid: "Неверный код",
    },
    success: {
      title: "Успешно завершено",
      desc: "Регистрация завершена (демо-режим).",
    },
  },

  theme: { toLight: "Включить светлую тему", toDark: "Включить тёмную тему" },

  kabinet: {
    header: {
      active: "Активен",
      logout: "Выйти",
      language: "Язык",
      category: {
        "first-time": "Сдаю впервые",
        "failed-before": "Ранее не сдал",
        "license-revoked": "Лишён прав",
      },
    },
    loadError: {
      title: "Не удалось загрузить данные",
      desc: "Проверьте подключение к интернету и попробуйте снова.",
      retry: "Повторить",
    },
    trial: { badge: "Новое", title: (topicTitle) => `Пробный тест: ${topicTitle}` },
    ready: {
      title: "Вы готовы к экзамену!",
      desc: "Вся 6-дневная программа успешно пройдена. Теперь можно перейти к итоговому внутреннему экзамену 7-го дня.",
    },
    continueCard: {
      eyebrow: "Продолжить обучение",
      location: (day, testNo) => `День ${day} · Тест №${testNo}`,
      stages: {
        video: "Посмотрите видеоурок",
        pdf: "Прочитайте ключевые слова",
        test: "Пройдите тест",
      },
      retryTest: (percent) => `Пройдите тест ещё раз — последний результат ${percent}%`,
      cta: "Продолжить",
    },
    overall: {
      eyebrow: "Общий прогресс",
      ariaLabel: "Процент пройденных тем",
      completedTopics: "Пройдено тем",
      completedDays: "Пройдено дней",
    },
    curriculum: {
      eyebrow: "Учебная программа",
      dayTitle: (day) => `День ${day}`,
      dayQuestions: (count) => `${num(count)} ${questionWord(count)}`,
      dayProgressAria: (day) => `Прогресс дня ${day}`,
      status: { completed: "Пройден", current: "Текущий", locked: "Закрыт" },
    },
    topic: {
      testNo: (testNo) => `Тест №${testNo}`,
      questions: (count) => `${num(count)} ${questionWord(count)}`,
      notStarted: "Не начата",
      lockedHint: (percent) => `Наберите не менее ${percent}% в тесте предыдущей темы`,
    },
    finalExam: {
      badge: "День 7",
      title: "Итоговый внутренний экзамен",
      pool: (count) => `База из ${num(count)} ${count % 10 === 1 && count % 100 !== 11 ? "вопроса" : "вопросов"}`,
      format: (questions, minutes) => `${questions} ${questionWord(questions)} · ${minutes} мин`,
      attempts: (used, max) => `Попытки: ${used}/${max}`,
      open: "Открыт",
      locked: "Закрыт",
      lockedHint: "Пройдите все темы 1–6-го дней",
    },
    randomTest: {
      title: "Случайный тест",
      questionsUnit: "вопросов",
      note: "Результаты не влияют на прогресс обучения.",
      pageTitle: (size) => `Случайный тест на ${size} ${questionWord(size)}`,
      pageTitleNoSize: "Случайный тест",
      soon: "Эта страница скоро заработает. Результаты не влияют на прогресс обучения.",
    },
    device: {
      detecting: "Определяется...",
      tablet: "Планшет",
      mobile: "Мобильный телефон",
      desktop: "Компьютер",
      current: "Текущее устройство · активно сейчас",
      singleDevice: "Одновременно можно войти только с одного устройства.",
    },
    topicPage: {
      soon: "Страница с видеоуроком, ключевыми словами и тестом по теме скоро заработает.",
    },
    backToKabinet: "Вернуться в кабинет",
  },

  testSession: {
    loading: "Загрузка...",
    loadError: "Не удалось загрузить вопросы. Попробуйте снова.",
    checkError: "Не удалось проверить ответ. Попробуйте снова.",
    solved: (current, total) => `Решено: ${current} / ${total}`,
    finishTest: "Завершить тест",
    finishConfirm: (unanswered) =>
      `Без ответа: ${unanswered} ${questionWord(unanswered)}. Завершить тест?`,
    finishConfirmYes: "Да, завершить",
    cancel: "Отмена",
    timeLeft: "Осталось времени",
    timeRunningOut: "Время заканчивается!",
    timeUp: "Время вышло!",
    redirecting: (seconds) => `Переход в кабинет через ${seconds} с`,
    goToKabinet: "Перейти в кабинет",
    keyboardHint: (count) => `Выбор ответа: F1–F${count} или 1–${count}`,
    resultTitle: "Результат",
    resultScore: (correct, total, percent) => `${correct} / ${total} верно (${percent}%)`,
    restart: "Начать заново",
    keyword: "Ключевое слово:",
    showHint: "Показать пояснение",
    hideHint: "Скрыть пояснение",
    prev: "Назад",
    next: "Следующий вопрос",
    imageAlt: "Изображение к вопросу",
    questionAria: (index, state) =>
      `Вопрос ${index}${
        state === "correct"
          ? ", дан верный ответ"
          : state === "incorrect"
            ? ", дан неверный ответ"
            : ""
      }`,
  },
};
