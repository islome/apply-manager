// Ikki rejim:
// 1) Telegram webhook (header: x-telegram-bot-api-secret-token) -> telegram_updates jadvaliga yozadi
// 2) Panel -> Telegram (header: Authorization: Bearer NOTIFY_SECRET) -> botdan xabar yuboradi
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TG_WEBHOOK_SECRET")!;
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET")!;
const DEFAULT_CHAT = Deno.env.get("TG_NOTIFY_CHAT_ID");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function sendMessage(chat_id: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
  });
  return { ok: res.ok, data: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Secret o'rnatilmagan bo'lsa "Bearer undefined" kabi qiymat o'tib ketmasin
  const missing = [
    !BOT && "TELEGRAM_BOT_TOKEN",
    !WEBHOOK_SECRET && "TG_WEBHOOK_SECRET",
    !NOTIFY_SECRET && "NOTIFY_SECRET",
  ].filter(Boolean);
  if (missing.length) {
    console.error("secret yo'q:", missing.join(", "));
    return json({ error: "not configured", missing }, 500);
  }

  // 1) Telegram -> panel
  const tgSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (tgSecret) {
    if (tgSecret !== WEBHOOK_SECRET) return json({ error: "forbidden" }, 403);
    const update = await req.json();
    const msg = update.message ?? update.edited_message ?? update.callback_query?.message;
    // chat_id == candidates.telegram_id (shaxsiy chatda), panelda shu orqali bog'lanadi
    const chatId = msg?.chat?.id ?? null;
    // chat_id == candidates.telegram_id -> nomzodni topamiz (topilmasa null)
    let candidateId = null;
    if (chatId) {
      const { data: cand } = await sb
        .from("candidates")
        .select("id")
        .eq("telegram_id", String(chatId))
        .maybeSingle();
      candidateId = cand?.id ?? null;
    }
    const { error } = await sb.from("telegram_updates").upsert(
      {
        update_id: update.update_id,
        chat_id: chatId,
        candidate_id: candidateId,
        text: update.message?.text ?? null,
        payload: update,
      },
      { onConflict: "update_id" },
    );
    if (error) {
      console.error("db", error.message);
      return json({ error: "db" }, 500); // Telegram qayta yuboradi
    }
    return json({ ok: true });
  }

  // 2) Panel -> Telegram
  if (req.headers.get("authorization") !== `Bearer ${NOTIFY_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const { candidate_id, chat_id, text } = await req.json();
  if (typeof text !== "string" || !text.trim()) return json({ error: "text kerak" }, 400);

  // Qabul qiluvchi: candidates.telegram_id (candidate_id orqali). chat_id faqat HR/admin xabari uchun.
  let target: string | number | undefined = chat_id ?? DEFAULT_CHAT;
  if (candidate_id) {
    const { data, error } = await sb
      .from("candidates")
      .select("telegram_id")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) return json({ error: "db" }, 500);
    if (!data?.telegram_id) return json({ error: "nomzodda telegram_id yo'q" }, 404);
    target = data.telegram_id;
  }
  if (!target) return json({ error: "candidate_id yoki chat_id kerak" }, 400);

  const r = await sendMessage(target, text.slice(0, 4000));
  // 403 = nomzod botni /start qilmagan yoki bloklagan
  return json(r.data, r.ok ? 200 : 502);
});
