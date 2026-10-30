import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Verifies the initData string a Telegram Mini App receives on launch.
// Telegram signs it with a key derived from the bot token, so only data that
// Telegram itself produced passes; anything typed in a plain browser fails.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyInitData(initData: string): TelegramUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

  // A signed but old initData could have been copied out of a session.
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    if (typeof user?.id !== "number" || typeof user.first_name !== "string") return null;
    return user;
  } catch {
    return null;
  }
}

// Reads "Authorization: tma <initData>" from a request.
export function telegramUserFrom(req: Request): TelegramUser | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("tma ") ? verifyInitData(auth.slice(4)) : null;
}

export function fullName(u: TelegramUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim().slice(0, 100);
}
