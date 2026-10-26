// All site copy, in Romanian and English. Placeholder figures and names are
// marked with "[placeholder]" comments and should be replaced with real data.

export type Lang = "ro" | "en";


const ro = {
  nav: {
    services: "Servicii",
    projects: "Proiecte",
    process: "Proces",
    team: "Echipă",
    faq: "Întrebări",
    cta: "Cere ofertă",
  },
  hero: {
    eyebrow: "Proiectare arhitecturală și de rezistență",
    title: ["Spații gândite", "până la ultima", "grindă."],
    lead: "ARCHED design unește arhitectura și ingineria structurală într-o singură echipă, de la prima schiță până la autorizația de construire.",
    primary: "Cere o ofertă",
    secondary: "Vezi proiectele",
    scroll: "Derulează",
  },
  stats: [
    // [placeholder] figures
    { value: 140, suffix: "+", label: "proiecte livrate" },
    { value: 96, suffix: "k", label: "m² proiectați" },
    { value: 12, suffix: "", label: "ani de experiență" },
    { value: 100, suffix: "%", label: "proiecte autorizate" },
  ],
  services: {
    eyebrow: "01 — Servicii",
    title: "Două discipline, un singur birou.",
    lead: "Arhitectul și inginerul lucrează la aceeași masă, așa că proiectul e coerent din prima și nu se reface la autorizare.",
    items: [
      {
        code: "A",
        title: "Proiectare arhitecturală",
        text: "Concept, volumetrie, planuri și fațade, cu atenție la lumină, funcțiune și buget.",
        list: [
          "Studiu de fezabilitate și concept",
          "Documentație pentru certificat de urbanism și autorizație (DTAC)",
          "Proiect tehnic și detalii de execuție",
          "Design de interior și randări 3D",
        ],
      },
      {
        code: "S",
        title: "Proiectare de rezistență",
        text: "Structuri sigure și eficiente din beton, metal sau lemn, calculate conform normativelor în vigoare.",
        list: [
          "Calcul structural și modelare 3D",
          "Expertiză tehnică și consolidări",
          "Fundații, cadre, planșee și acoperișuri",
          "Asistență tehnică pe șantier",
        ],
      },
    ],
  },
  projects: {
    eyebrow: "02 — Proiecte",
    title: "Case individuale.",
    lead: "Locuințe gândite pentru teren, lumină și felul în care trăiesc oamenii care le locuiesc.",
    // [placeholder] names, years and areas
    items: [
      { name: "Casa Ardezie", type: "Casă individuală", year: "2025", area: "260 m²", image: "/projects/casa-ardezie.webp" },
      { name: "Casa Stâncă", type: "Casă pe teren în pantă", year: "2025", area: "310 m²", image: "/projects/casa-stanca.webp" },
      { name: "Vilele Teilor", type: "Ansamblu de case cuplate", year: "2024", area: "4 × 180 m²", image: "/projects/vile-teilor.webp" },
      { name: "Casa Lumina", type: "Casă parter", year: "2024", area: "220 m²", image: "/projects/casa-lumina.jpg" },
    ],
  },
  band: {
    caption: "Casa Stâncă — piatră, lemn și metal, așezate pe pantă.",
  },
  process: {
    eyebrow: "03 — Proces",
    title: "De la idee la autorizație, pas cu pas.",
    steps: [
      { title: "Consultație", text: "Discutăm nevoile, terenul și bugetul. Vă spunem sincer ce se poate construi." },
      { title: "Concept", text: "Propunem variante de volumetrie și planuri, până găsim soluția potrivită." },
      { title: "Calcul structural", text: "Inginerul dimensionează structura în paralel cu arhitectura, nu după." },
      { title: "Autorizare", text: "Pregătim documentația completă și o susținem până la obținerea autorizației." },
      { title: "Execuție", text: "Livrăm detaliile de execuție și verificăm pe șantier că totul se construiește corect." },
    ],
  },
  team: {
    eyebrow: "04 — Echipă",
    title: "Oamenii din spatele planșelor.",
    // [placeholder] team
    members: [
      { name: "Andrei Popescu", role: "Arhitect-șef, fondator" },
      { name: "Elena Rusu", role: "Inginer structurist" },
      { name: "Mihai Ionescu", role: "Arhitect" },
      { name: "Ana Ciobanu", role: "Inginer, expert tehnic" },
    ],
  },
  faq: {
    eyebrow: "05 — Întrebări frecvente",
    title: "Ce ne întreabă clienții.",
    items: [
      {
        q: "Cât durează un proiect pentru o casă?",
        a: "De regulă 4–8 săptămâni pentru documentația de autorizare, în funcție de complexitate și de cât de repede se iau deciziile pe concept.",
      },
      {
        q: "Ce documente trebuie să aduc la prima întâlnire?",
        a: "Extrasul de carte funciară, planul cadastral și certificatul de urbanism, dacă îl aveți. Dacă nu, vă ajutăm să le obțineți.",
      },
      {
        q: "Faceți și doar proiectul de rezistență?",
        a: "Da. Lucrăm și cu arhitecți din afara biroului, pentru calcul structural, expertize și consolidări.",
      },
      {
        q: "Cum se calculează prețul?",
        a: "În funcție de suprafață, destinație și fazele de proiectare de care aveți nevoie. După prima discuție primiți o ofertă fixă, fără costuri ascunse.",
      },
      {
        q: "Ne ajutați și în timpul construcției?",
        a: "Da, oferim asistență tehnică pe șantier și răspundem la întrebările constructorului pe toată durata execuției.",
      },
    ],
  },
  contact: {
    eyebrow: "06 — Contact",
    title: "Să construim ceva împreună.",
    lead: "Spuneți-ne despre proiect sau programați o consultație. Răspundem în maximum o zi lucrătoare.",
    tabs: { quote: "Cerere ofertă", meeting: "Programare consultație" },
    fields: {
      name: "Nume și prenume",
      phone: "Telefon",
      email: "Email",
      type: "Tipul proiectului",
      area: "Suprafață estimată (m²)",
      message: "Spuneți-ne mai multe",
      date: "Alegeți ziua",
      time: "Alegeți ora",
    },
    types: ["Casă individuală", "Bloc de locuințe", "Spațiu comercial", "Hală / industrial", "Consolidare / expertiză", "Altceva"],
    send: "Trimite cererea",
    book: "Programează",
    sent: "Mulțumim! Vă contactăm în curând.",
    booked: "Consultația a fost rezervată pentru",
    again: "Trimite altă cerere",
    sending: "Se trimite…",
    errors: {
      required: "Completați acest câmp.",
      name: "Introduceți un nume valid.",
      phone: "Introduceți un număr de telefon valid.",
      email: "Introduceți un email valid.",
      slot: "Alegeți ziua și ora consultației.",
      tooLong: "Mesajul este prea lung.",
      server: "Nu am putut trimite cererea. Încercați din nou sau sunați-ne.",
    },
    office: "Birou",
    address: "Str. Exemplu 12, Oraș", // [placeholder]
    phoneValue: "+00 000 000 000", // [placeholder]
    emailValue: "office@arched.design", // [placeholder]
    hours: "Luni–Vineri, 9:00–18:00",
  },
  footer: {
    rights: "Toate drepturile rezervate.",
    tagline: "Arhitectură și rezistență.",
  },
  weekdays: ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"],
  months: ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"],
};

export type Dict = typeof ro;

const en: Dict = {
  nav: {
    services: "Services",
    projects: "Projects",
    process: "Process",
    team: "Team",
    faq: "FAQ",
    cta: "Get a quote",
  },
  hero: {
    eyebrow: "Architectural & structural design",
    title: ["Spaces designed", "down to the", "last beam."],
    lead: "ARCHED design brings architecture and structural engineering into one team, from the first sketch to the building permit.",
    primary: "Request a quote",
    secondary: "See projects",
    scroll: "Scroll",
  },
  stats: [
    { value: 140, suffix: "+", label: "projects delivered" },
    { value: 96, suffix: "k", label: "m² designed" },
    { value: 12, suffix: "", label: "years of practice" },
    { value: 100, suffix: "%", label: "projects permitted" },
  ],
  services: {
    eyebrow: "01 — Services",
    title: "Two disciplines, one studio.",
    lead: "Architect and engineer work at the same table, so the design is coherent from day one and never redrawn at permitting.",
    items: [
      {
        code: "A",
        title: "Architectural design",
        text: "Concept, massing, plans and façades, with care for light, function and budget.",
        list: [
          "Feasibility study and concept",
          "Zoning certificate and building permit documentation",
          "Technical design and construction details",
          "Interior design and 3D renderings",
        ],
      },
      {
        code: "S",
        title: "Structural design",
        text: "Safe, efficient structures in concrete, steel or timber, calculated to current codes.",
        list: [
          "Structural analysis and 3D modelling",
          "Technical assessment and strengthening",
          "Foundations, frames, slabs and roofs",
          "On-site technical support",
        ],
      },
    ],
  },
  projects: {
    eyebrow: "02 — Projects",
    title: "Private houses.",
    lead: "Homes shaped by their site, their light and the way the people inside them live.",
    items: [
      { name: "Slate House", type: "Single-family house", year: "2025", area: "260 m²", image: "/projects/casa-ardezie.webp" },
      { name: "Stone House", type: "Hillside house", year: "2025", area: "310 m²", image: "/projects/casa-stanca.webp" },
      { name: "Teilor Villas", type: "Semi-detached ensemble", year: "2024", area: "4 × 180 m²", image: "/projects/vile-teilor.webp" },
      { name: "Lumina House", type: "Single-storey house", year: "2024", area: "220 m²", image: "/projects/casa-lumina.jpg" },
    ],
  },
  band: {
    caption: "Stone House — stone, timber and metal, set into the slope.",
  },
  process: {
    eyebrow: "03 — Process",
    title: "From idea to permit, step by step.",
    steps: [
      { title: "Consultation", text: "We talk through your needs, site and budget, and tell you honestly what can be built." },
      { title: "Concept", text: "We propose massing and plan options until we find the right solution." },
      { title: "Structural analysis", text: "The engineer sizes the structure alongside the architecture, not after it." },
      { title: "Permitting", text: "We prepare the complete documentation and see it through to the building permit." },
      { title: "Construction", text: "We deliver construction details and check on site that everything is built right." },
    ],
  },
  team: {
    eyebrow: "04 — Team",
    title: "The people behind the drawings.",
    members: [
      { name: "Andrei Popescu", role: "Principal architect, founder" },
      { name: "Elena Rusu", role: "Structural engineer" },
      { name: "Mihai Ionescu", role: "Architect" },
      { name: "Ana Ciobanu", role: "Engineer, technical expert" },
    ],
  },
  faq: {
    eyebrow: "05 — FAQ",
    title: "What clients ask us.",
    items: [
      {
        q: "How long does a house design take?",
        a: "Usually 4–8 weeks for the permit documentation, depending on complexity and how quickly concept decisions are made.",
      },
      {
        q: "What should I bring to the first meeting?",
        a: "The land registry extract, cadastral plan and zoning certificate if you have it. If not, we help you get them.",
      },
      {
        q: "Do you do structural design only?",
        a: "Yes. We also work with outside architects on structural analysis, assessments and strengthening.",
      },
      {
        q: "How is the fee calculated?",
        a: "By area, building type and the design stages you need. After our first talk you get a fixed quote with no hidden costs.",
      },
      {
        q: "Do you support us during construction?",
        a: "Yes, we provide on-site technical support and answer the contractor's questions throughout the build.",
      },
    ],
  },
  contact: {
    eyebrow: "06 — Contact",
    title: "Let's build something together.",
    lead: "Tell us about your project or book a consultation. We reply within one working day.",
    tabs: { quote: "Request a quote", meeting: "Book a consultation" },
    fields: {
      name: "Full name",
      phone: "Phone",
      email: "Email",
      type: "Project type",
      area: "Estimated area (m²)",
      message: "Tell us more",
      date: "Pick a day",
      time: "Pick a time",
    },
    types: ["Single house", "Apartment building", "Commercial space", "Industrial / hall", "Strengthening / assessment", "Something else"],
    send: "Send request",
    book: "Book",
    sent: "Thank you! We'll be in touch soon.",
    booked: "Your consultation is booked for",
    again: "Send another request",
    sending: "Sending…",
    errors: {
      required: "Please fill in this field.",
      name: "Please enter a valid name.",
      phone: "Please enter a valid phone number.",
      email: "Please enter a valid email.",
      slot: "Please pick a day and time.",
      tooLong: "The message is too long.",
      server: "We couldn’t send your request. Please try again or call us.",
    },
    office: "Office",
    address: ro.contact.address,
    phoneValue: ro.contact.phoneValue,
    emailValue: ro.contact.emailValue,
    hours: "Monday–Friday, 9:00–18:00",
  },
  footer: {
    rights: "All rights reserved.",
    tagline: "Architecture & structure.",
  },
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

export const dicts: Record<Lang, Dict> = { ro, en };
