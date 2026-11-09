import Footer from "@/components/home/Footer";
import { getRequisites } from "@/config/requisites.server";

/** Server qismi: rekvizitlarni tekshirib, footer'ga faqat ko'rsatiladigan qiymatlarni beradi. */
export default function SiteFooter() {
  const { sellerName, stir, address } = getRequisites();
  return <Footer requisites={{ sellerName, stir, address }} />;
}
