// Interior styles offered for visualizations, with labels for the forms.
// The English prompt for each one lives on the server in gpt-image.ts.

export const STYLES = ["modern", "minimal", "scandi", "loft", "classic"] as const;
export type Style = (typeof STYLES)[number];

export const isStyle = (s: unknown): s is Style => STYLES.includes(s as Style);

export const STYLE_LABEL: Record<"ro" | "en", Record<Style, string>> = {
  ro: { modern: "Modern", minimal: "Minimalist", scandi: "Scandinav", loft: "Loft", classic: "Clasic modern" },
  en: { modern: "Modern", minimal: "Minimalist", scandi: "Scandinavian", loft: "Loft", classic: "Modern classic" },
};

// "You have used 5 of 5" message pieces shared by the admin page and Mini App.
export function resetTime(iso: string, lang: "ro" | "en") {
  return new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
