// Envío de mensajes a Telegram mediante un bot. El token del bot y el
// chat de destino se configuran por variables de entorno:
//   TELEGRAM_BOT_TOKEN  — el que da @BotFather
//   TELEGRAM_CHAT_ID     — el chat (privado o grupo) donde llegan los reportes
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("Falta configurar TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram: ${json.description ?? "error desconocido"}`);
  }
}
