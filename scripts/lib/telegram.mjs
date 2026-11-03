// Send one Telegram message (HTML by default). Returns true on success. One
// place for the endpoint + payload shape, used by the reminder script.
export async function sendTelegram(botToken, chatId, text, { html = true } = {}) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(html ? { parse_mode: "HTML" } : {}),
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.error("telegram send failed:", await res.text());
  return res.ok;
}
