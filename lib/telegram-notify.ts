// Nomzodga Job Applier boti orqali xabar yuboradi. Xato bo'lsa FAQAT logga yozadi (HR amali buzilmaydi).

const STATUS_TEXT: Record<string, string> = {
  new: 'Yangi',
  confirmed: 'Tasdiqlandi',
  interview: 'Suhbat',
  hired: 'Qabul qilindi',
  cancel: 'Rad etildi',
};

export function statusMessage(status: string, vacancyTitle?: string | null): string {
  const label = STATUS_TEXT[status] ?? status;
  const vacancy = vacancyTitle ? ` («${vacancyTitle}»)` : '';
  return `Arizangiz${vacancy} holati yangilandi: ${label}.\nBatafsil ma'lumot ilovada.`;
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN is not set; notification skipped');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { description?: string } | null;
      console.error('[telegram] sendMessage failed:', res.status, body?.description);
    }
  } catch (e) {
    console.error('[telegram] sendMessage error:', e instanceof Error ? e.message : e);
  }
}
