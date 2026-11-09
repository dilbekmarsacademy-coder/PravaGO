import { BUSINESS } from "@/config/business";
import type { Requisites } from "@/config/requisites.server";

/** Rekvizitlar qatorlari (/oferta, /aloqa). Bo'sh qiymatlar RequisitesList'da ko'rsatilmaydi. */
export function requisiteRows(r: Requisites): [string, string | null][] {
  const hasBank = Boolean(r.mfo || r.bankAccount);
  return [
    ["Sotuvchi", r.sellerName],
    ["STIR", r.stir],
    ["Soliq rejimi", BUSINESS.taxRegime],
    ["Manzil", r.address],
    ["Bank", hasBank ? r.bankName : null],
    ["MFO", r.mfo],
    ["Hisob raqam", r.bankAccount],
    ["Telefon", BUSINESS.phone],
    ["Email", BUSINESS.email],
  ];
}
