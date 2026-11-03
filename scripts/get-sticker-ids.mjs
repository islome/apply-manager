// Sticker paketidagi file_id larni chiqaradi (har bir bot uchun file_id alohida bo'ladi).
// Ishlatish: TELEGRAM_BOT_TOKEN ni .env.local ga qo'yib:
//   node --env-file=.env.local scripts/get-sticker-ids.mjs <paket_nomi>
// Paket nomi: t.me/addstickers/<paket_nomi> havolasidagi nom. Natijani Vercel env ga qo'ying:
//   TELEGRAM_STICKER_CONFIRMED, TELEGRAM_STICKER_INTERVIEW, TELEGRAM_STICKER_HIRED
const token = process.env.TELEGRAM_BOT_TOKEN;
const pack = process.argv[2];
if (!token || !pack) {
  console.error('Usage: TELEGRAM_BOT_TOKEN=... node scripts/get-sticker-ids.mjs <pack_name>');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/getStickerSet?name=${encodeURIComponent(pack)}`);
const data = await res.json();
if (!data.ok) {
  console.error(data.description);
  process.exit(1);
}
data.result.stickers.forEach((s, i) => console.log(`${i + 1}\t${s.emoji ?? ''}\t${s.file_id}`));
