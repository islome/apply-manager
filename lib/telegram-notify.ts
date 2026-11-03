// Nomzodga Job Applier boti orqali xabar yuboradi. Xato bo'lsa FAQAT logga yozadi (HR amali buzilmaydi).

const DEFAULT_APP_URL = 'https://applier-bot.vercel.app/';

type Env = Record<string, string | undefined>;
const env = (): Env =>
  (globalThis as typeof globalThis & { process?: { env?: Env } }).process?.env ?? {};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Copy = { title: string; body: string; button: string; buttonPath: string };

// Har bosqich uchun alohida xabar. {v} = vakansiya nomi (qalin), {name} = nomzod ismi.
const COPY: Record<string, Copy> = {
  new: {
    title: '📥 Arizangiz qabul qilindi',
    body: '{v} bo‘yicha arizangiz ko‘rib chiqish navbatida. Natijani shu yerda xabar qilamiz.',
    button: '📱 Ilovani ochish',
    buttonPath: 'applications',
  },
  confirmed: {
    title: '✅ Arizangiz tasdiqlandi!',
    body:
      '{v} bo‘yicha arizangiz HR tomonidan ko‘rib chiqilib, tasdiqlandi. 🚀\n' +
      'Keyingi bosqich haqida tez orada xabar beramiz. Telefoningiz yoqilgan bo‘lsin! 📞',
    button: '📱 Ilovani ochish',
    buttonPath: 'applications',
  },
  interview: {
    title: '🎤 Suhbatga taklif qilindingiz!',
    body:
      'Tabriklaymiz! {v} bo‘yicha sizni suhbatga taklif qilamiz. 🌟\n' +
      'HR siz bilan tez orada bog‘lanadi. Suhbatga tayyorlanib, o‘zingizga ishoning! 💪',
    button: '📱 Ilovani ochish',
    buttonPath: 'applications',
  },
  hired: {
    title: '🎉 Tabriklaymiz, siz qabul qilindingiz!',
    body:
      '{v} bo‘yicha jamoamizga qo‘shilishingizni mamnuniyat bilan e’lon qilamiz! 🥳🏆\n' +
      'HR keyingi qadamlar haqida siz bilan bog‘lanadi.',
    button: '📱 Ilovani ochish',
    buttonPath: 'applications',
  },
  cancel: {
    title: '🌱 Arizangiz bo‘yicha yangilik',
    body:
      'Afsuski, {v} bo‘yicha bu safar boshqa nomzod tanlandi. 😔\n' +
      'Bu sizning qobiliyatingiz past degani emas. Boshqa vakansiyalarni ko‘rib chiqing, sizga mos ish albatta topiladi! 💫',
    button: '🔎 Boshqa vakansiyalar',
    buttonPath: 'vacancies',
  },
};

export type StatusMessage = { text: string; button: string; url: string; sticker?: string };

/** HR statusni o'zgartirganda nomzodga boradigan xabar (HTML), tugma va (bo'lsa) sticker. */
export function buildStatusMessage(
  status: string,
  opts: { vacancyTitle?: string | null; fullName?: string | null } = {},
): StatusMessage | null {
  const copy = COPY[status];
  if (!copy) return null;

  const vacancy = opts.vacancyTitle ? `«<b>${esc(opts.vacancyTitle)}</b>»` : 'vakansiya';
  const hello = opts.fullName ? `${esc(opts.fullName.split(' ')[0])}, ` : '';
  const body = copy.body.replace('{v}', vacancy);
  const text = `<b>${copy.title}</b>\n\n${hello ? `${hello}` : ''}${hello ? body.charAt(0).toLowerCase() + body.slice(1) : body}`;

  const base = env().MINI_APP_URL || DEFAULT_APP_URL;
  return {
    text,
    button: copy.button,
    url: new URL(copy.buttonPath, base).toString(),
    // Ixtiyoriy: TELEGRAM_STICKER_<STATUS> = sticker file_id (cancel uchun sticker qo'yilmaydi)
    sticker: status === 'cancel' ? undefined : env()[`TELEGRAM_STICKER_${status.toUpperCase()}`],
  };
}

async function tg(method: string, payload: Record<string, unknown>): Promise<boolean> {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN is not set; notification skipped');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { description?: string } | null;
      console.error(`[telegram] ${method} failed:`, res.status, body?.description);
    }
    return res.ok;
  } catch (e) {
    console.error(`[telegram] ${method} error:`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Sticker (bo'lsa) + matn + «Ilovani ochish» (web_app) tugmasi. Hech qachon throw qilmaydi. */
export async function notifyStatusChange(
  chatId: number,
  status: string,
  opts: { vacancyTitle?: string | null; fullName?: string | null } = {},
): Promise<void> {
  const msg = buildStatusMessage(status, opts);
  if (!msg) return;

  if (msg.sticker) await tg('sendSticker', { chat_id: chatId, sticker: msg.sticker });

  await tg('sendMessage', {
    chat_id: chatId,
    text: msg.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: msg.button, web_app: { url: msg.url } }]] },
  });
}
