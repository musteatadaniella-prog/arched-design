import "server-only";

// Our details printed on every invoice. Real values go in .env.local / Vercel;
// the defaults below are placeholders for the demo.
export type Company = {
  name: string;
  idno: string;
  vat: string;
  address: string;
  iban: string;
  bank: string;
  bic: string;
  email: string;
  phone: string;
};

export function company(): Company {
  const e = process.env;
  return {
    name: e.COMPANY_NAME || "Arched Design SRL",
    idno: e.COMPANY_IDNO || "1024600012345",
    vat: e.COMPANY_VAT || "0612345",
    address: e.COMPANY_ADDRESS || "str. Arhitecților 12, of. 3, MD-2001 Chișinău, Republica Moldova",
    iban: e.COMPANY_IBAN || "MD24AG000225100013104168",
    bank: e.COMPANY_BANK || "BC „Moldova-Agroindbank” SA",
    bic: e.COMPANY_BIC || "AGRNMD2X",
    email: e.COMPANY_EMAIL || "office@arched.md",
    phone: e.COMPANY_PHONE || "+373 22 000 000",
  };
}

// Days the client has to pay, counted from the issue date.
export const INVOICE_DUE_DAYS = 7;
