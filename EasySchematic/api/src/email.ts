import PostalMime from "postal-mime";

interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

interface EmailEnv {
  easyschematic_db: D1Database;
  SUPPORT_FORWARD_EMAIL: string;
}

export async function handleEmail(message: EmailMessage, env: EmailEnv) {
  const rawEmail = new Response(message.raw);
  const arrayBuffer = await rawEmail.arrayBuffer();

  const parser = new PostalMime();
  const parsed = await parser.parse(arrayBuffer);

  const id = crypto.randomUUID();
  const fromEmail = parsed.from?.address || message.from;
  const fromName = parsed.from?.name || null;
  const subject = parsed.subject || null;
  const bodyText = parsed.text || null;
  const bodyHtml = parsed.html || null;
  const messageId = parsed.messageId || null;

  // Serialize headers
  const headerObj: Record<string, string> = {};
  for (const [key, value] of message.headers) {
    headerObj[key] = value;
  }

  await env.easyschematic_db
    .prepare(
      `INSERT INTO support_emails (id, message_id, from_email, from_name, to_email, subject, body_text, body_html, headers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, messageId, fromEmail, fromName, message.to, subject, bodyText, bodyHtml, JSON.stringify(headerObj))
    .run();

  // Forward to Gmail — non-fatal if it fails, email is already stored
  try {
    await message.forward(env.SUPPORT_FORWARD_EMAIL);
  } catch (err) {
    console.error("Failed to forward email:", err);
  }
}
