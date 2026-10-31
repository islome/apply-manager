// Next.js server tomonida ishlatiladi (API route / server action). Brauzerga CHIQARMANG.
const URL_ = process.env.TELEGRAM_FUNCTION_URL!; // .../functions/v1/telegram-notification
const SECRET = process.env.TELEGRAM_NOTIFY_SECRET!;

// candidateId -> funksiya candidates.telegram_id ni o'zi topadi (id ustuni nomi boshqacha bo'lsa o'zgartiring)
export async function notifyCandidate(candidateId: string | number, text: string) {
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ candidate_id: candidateId, text }),
    });
    return res.ok;
  } catch {
    return false; // xabar yuborilmasa asosiy amal buzilmasin
  }
}

// Misol: yangi ariza kelganda
// await notifyCandidate(candidate.id, `Arizangiz qabul qilindi: <b>${vacancyTitle}</b>`);
