import type { Metadata, Viewport } from "next";
import { MiniApp } from "./MiniApp";

export const metadata: Metadata = {
  title: "ARCHED design",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#eae3e0",
};

// Telegram Mini App: opened from the bot's menu button. Everything personal is
// loaded by MiniApp only after the server has verified Telegram's signature.
export default function TelegramPage() {
  return <MiniApp bot={process.env.TELEGRAM_BOT_USERNAME ?? ""} />;
}
