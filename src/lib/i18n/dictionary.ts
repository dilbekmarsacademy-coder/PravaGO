import type { ExamStatus } from "@/components/home/types";

export type Locale = "uz-latn" | "uz-cyrl" | "ru";

export const LOCALE_META: { value: Locale; label: string }[] = [
  { value: "uz-latn", label: "UZ" },
  { value: "uz-cyrl", label: "ЎЗ" },
  { value: "ru", label: "RU" },
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
      natijalar: string;
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
  };

  pricing: {
    eyebrow: string;
    heading: string;
    desc: string;
    somLabel: string;
    ommabop: string;
    tanlash: string;
    plans: {
      name: string;
      price: string;
      periodLabel: string;
      desc: string;
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

  footer: {
    tagline: string;
    copyright: string;
  };

  registerModal: {
    qadam: (current: number, total: number) => string;
    yopish: string;
    offer: {
      title: string;
      checkbox: string;
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
}
