import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, TELEGRAM_HANDLE } from "@/config/business";
import { getRequisites } from "@/config/requisites.server";
import { TARIFFS, TARIFF_RULES, formatSom, inheritsLabel } from "@/config/tariffs";
import { organizationLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { DocCard, DocSection, PublicPage, RequisitesList } from "@/components/legal/PublicPage";
import { requisiteRows } from "@/components/legal/requisites";

// TODO(yurist): oferta matnini yurist ko'rib chiqishi kerak (saytga chiqishdan oldin).

const TITLE = "Ommaviy oferta";
const DESCRIPTION = "PravaIshonch onlayn taʼlim xizmatini koʻrsatish boʻyicha ommaviy oferta (shartnoma): tomonlar, narxlar, toʻlov tartibi, foydalanish qoidalari va rekvizitlar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/oferta" },
  openGraph: { title: `${TITLE} — PravaIshonch`, description: DESCRIPTION, url: `${SITE_URL}/oferta` },
};

export default function OfferPage() {
  const requisites = getRequisites();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd(requisites),
      { "@type": "WebPage", name: TITLE, url: `${SITE_URL}/oferta`, inLanguage: "uz", about: { "@id": `${SITE_URL}/#organization` } },
    ],
  };

  return (
    <PublicPage
      eyebrow="Hujjatlar"
      title="Ommaviy oferta (xizmat koʻrsatish shartnomasi)"
      lead="Ushbu hujjat PravaIshonch platformasida onlayn taʼlim xizmatini koʻrsatish shartlarini belgilaydi. Toʻlov qilish ushbu shartlarni toʻliq qabul qilish hisoblanadi."
      updated="2026-yil 9-noyabr"
      jsonLd={jsonLd}
    >
      <DocCard>
        <DocSection title="1. Tomonlar">
          <p>
            <b>Sotuvchi (Ijrochi):</b> {requisites.sellerName}
            {requisites.stir ? <> (STIR {requisites.stir})</> : null}, “{BUSINESS.brandName}” ({BUSINESS.altBrandName}) nomi bilan faoliyat yurituvchi yakka tartibdagi tadbirkor.
          </p>
          <p>
            <b>Xaridor (Foydalanuvchi):</b> ushbu oferta shartlarini qabul qilgan, {BUSINESS.minAge} yoshga toʻlgan jismoniy shaxs.
          </p>
        </DocSection>

        <DocSection title="2. Xizmat predmeti">
          <p>
            Sotuvchi Xaridorga <b>{BUSINESS.serviceDescription.toLowerCase()}</b> xizmatini koʻrsatadi: pravaishonch.uz saytidagi shaxsiy kabinet orqali tanlangan tarifga
            muvofiq testlar, video darslar, kalit soʻzlar, yakuniy ichki imtihon va boshqa materiallarga muddatli kirish huquqi beriladi.
          </p>
          <p>Xizmat onlayn koʻrsatiladi; jismoniy tovar yetkazib berilmaydi. Testlar YHXBB imtihon savollari asosida tayyorlangan.</p>
        </DocSection>

        <DocSection title="3. Ofertani qabul qilish (aktsept)">
          <p>
            Xaridor tanlangan tarif uchun toʻlovni amalga oshirgan paytdan boshlab ushbu oferta shartlari toʻliq va soʻzsiz qabul qilingan hisoblanadi va shartnoma tuzilgan
            sanaladi. Roʻyxatdan oʻtishda Xaridor {BUSINESS.minAge} yoshdan katta ekanini hamda oferta va <Link href="/maxfiylik">maxfiylik siyosati</Link> bilan tanishganini
            tasdiqlaydi.
          </p>
        </DocSection>

        <DocSection title="4. Narxlar va toʻlov tartibi">
          <ul>
            <li>Narxlar oʻzbek soʻmida koʻrsatiladi va <Link href="/tariflar">tariflar sahifasida</Link> eʼlon qilinadi. Sotuvchi QQS toʻlovchisi emas.</li>
            <li>Toʻlov onlayn toʻlov tizimlari — Payme, Click (keyinroq Uzum Bank) orqali Uzcard, Humo va boshqa bank kartalari bilan amalga oshiriladi.</li>
            <li>Karta maʼlumotlari toʻlov tizimi sahifasida kiritiladi; Sotuvchi ularni koʻrmaydi va saqlamaydi.</li>
            <li>Kirish huquqi toʻlov tasdiqlangandan keyin ochiladi. Toʻlov qilingan narx tanlangan muddat davomida oʻzgarmaydi.</li>
          </ul>
        </DocSection>

        <DocSection title="5. Tariflar va muddatlar">
          <ul>
            {TARIFFS.map((t) => (
              <li key={t.id}>
                <b>{t.name}</b> — {t.options.map((o) => `${formatSom(o.price)} (${o.durationDays ? `${o.label}, ${o.durationDays} kun` : o.label.toLowerCase()})`).join(", ")}.{" "}
                {[inheritsLabel(t), t.features.join("; ")].filter(Boolean).join(" ")}.
              </li>
            ))}
          </ul>
          <p>
            <b>Standart</b> tarifida obuna muddati toʻlov tasdiqlangan kundan boshlab hisoblanadi. Muddat tugagach natijalar saqlanib qoladi va ularni koʻrish mumkin, ammo
            yangi testlar va imtihonlarni topshirish yopiladi.
          </p>
          <p>
            <b>Premium</b> va <b>Mentor</b> tariflarida xizmat Xaridor haydovchilik guvohnomasi imtihonidan oʻtgunicha taqdim etiladi. Xaridor imtihondan oʻtganidan
            keyin administrator uning akkauntiga kirishni yopadi (foydalanuvchini saytdan chiqaradi). <b>Mentor</b> tarifida ustoz Xaridor bilan koʻrishib, 2 kun
            davomida jonli dars oʻtib beradi; dars vaqti va joyi tomonlar tomonidan kelishiladi.
          </p>
          <p>Roʻyxatdan oʻtgan foydalanuvchiga {TARIFF_RULES.trialDays} kunlik bepul sinov beriladi.</p>
        </DocSection>

        <DocSection title="6. Qaytarish">
          <p>
            Bepul sinovdan keyin amalga oshirilgan toʻlov qaytarilmaydi. Sotuvchi tomonidagi texnik sabab bilan xizmatdan foydalanib boʻlmagan vaqt obuna muddatiga
            qoʻshib beriladi. Batafsil: <Link href="/qaytarish">qaytarish siyosati</Link>.
          </p>
        </DocSection>

        <DocSection title="7. Akkaunt va qurilma">
          <ul>
            <li>Bitta akkaunt faqat {TARIFF_RULES.maxDevices} ta qurilmada foydalanish uchun moʻljallangan. Boshqa qurilmadan kirish oldingi qurilmadagi sessiyani yopishi mumkin.</li>
            <li>Qurilmani almashtirish zarur boʻlsa, Xaridor qoʻllab-quvvatlash xizmatiga murojaat qiladi.</li>
          </ul>
        </DocSection>

        <DocSection title="8. Xaridorning majburiyatlari">
          <ul>
            <li>Akkaunt va unga kirish maʼlumotlarini boshqa shaxslarga bermaslik, sotmaslik va birgalikda foydalanmaslik.</li>
            <li>Video darslar, testlar, kalit soʻzlar va boshqa materiallarni yozib olmaslik, nusxalamaslik, tarqatmaslik va boshqa saytlarda joylashtirmaslik.</li>
            <li>Platformaning ishlashiga xalaqit beradigan harakatlar qilmaslik.</li>
            <li>Roʻyxatdan oʻtishda toʻgʻri maʼlumot koʻrsatish.</li>
          </ul>
          <p>Ushbu majburiyatlar buzilganda Sotuvchi akkauntga kirishni toʻlov qaytarilmagan holda cheklashi mumkin.</p>
        </DocSection>

        <DocSection title="9. Sotuvchining majburiyatlari">
          <ul>
            <li>Toʻlangan muddat davomida tanlangan tarifdagi materiallarga kirishni taʼminlash.</li>
            <li>Xaridorning shaxsiy maʼlumotlarini <Link href="/maxfiylik">maxfiylik siyosatiga</Link> muvofiq himoya qilish.</li>
            <li>Murojaatlarga ish vaqtida ({BUSINESS.workingHours}) javob berish.</li>
          </ul>
        </DocSection>

        <DocSection title="10. Intellektual mulk">
          <p>
            Platformadagi barcha materiallar (video darslar, matnlar, kalit soʻzlar, testlar tuzilishi, dizayn, logotiplar) Sotuvchiga tegishli yoki qonuniy asosda
            foydalaniladi. Xaridorga faqat shaxsiy, notijorat maqsadda foydalanish huquqi beriladi.
          </p>
        </DocSection>

        <DocSection title="11. Javobgarlik chegarasi">
          <ul>
            <li>Xizmat imtihonga tayyorgarlik uchun moʻljallangan. Imtihon natijasi Xaridorning bilimi va tayyorgarligiga bogʻliq; Sotuvchi imtihondan oʻtishni kafolatlamaydi.</li>
            <li>Sotuvchi Internet provayderi, toʻlov tizimlari yoki Xaridor qurilmasidagi nosozliklar uchun javobgar emas.</li>
            <li>Sotuvchining javobgarligi har qanday holatda Xaridor tomonidan toʻlangan summa bilan cheklanadi.</li>
          </ul>
        </DocSection>

        <DocSection title="12. Nizolarni hal qilish">
          <p>
            Shikoyat va takliflar Telegram orqali yuboriladi:{" "}
            <a href={BUSINESS.telegram} target="_blank" rel="noopener noreferrer">
              {TELEGRAM_HANDLE}
            </a>
            . Murojaatga <b>3 ish kuni</b> ichida javob beriladi. Kelishuvga erishilmasa, nizo Oʻzbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.
          </p>
        </DocSection>

        <DocSection title="13. Yakuniy qoidalar">
          <p>
            Sotuvchi oferta shartlarini oʻzgartirishi mumkin; yangi tahrir saytda eʼlon qilingan kundan kuchga kiradi. Toʻlangan obuna muddati uchun toʻlov paytidagi
            narx va tarif tarkibi saqlanadi.
          </p>
        </DocSection>

        <DocSection id="rekvizitlar" title="14. Sotuvchi rekvizitlari">
          <RequisitesList rows={requisiteRows(requisites)} />
        </DocSection>
      </DocCard>
    </PublicPage>
  );
}
