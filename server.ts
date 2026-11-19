import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanString(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 160;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReceiptRow {
  label: string;
  value: string;
}

interface MailOutcome {
  email_configured: boolean;
  user_email_sent: boolean;
  operator_email_sent: boolean;
}

function getSmtpConfig(): { host: string; port: number; user: string; pass: string; notifyTo: string } | null {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!user || !pass || user.startsWith("MY_") || pass.startsWith("MY_")) {
    return null;
  }
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const parsedPort = Number(process.env.SMTP_PORT || "465");
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 465;
  const rawNotify = (process.env.NOTIFY_EMAIL || "").trim();
  const notifyTo = rawNotify && !rawNotify.startsWith("MY_") ? rawNotify : user;
  return { host, port, user, pass, notifyTo };
}

function buildReceiptEmailHtml(title: string, refId: string, rows: ReceiptRow[], summary: string, footerNote: string): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eceae4;color:#5c5c5c;font-size:14px;width:40%;vertical-align:top;">${escapeHtml(r.label)}</td><td style="padding:8px 0;border-bottom:1px solid #eceae4;color:#1a1a1a;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(r.value)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#FAF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #d8d2c5;border-radius:6px;padding:24px;">
    <div style="font-size:16px;font-weight:700;color:#1F5C3F;margin-bottom:4px;">Idle Spot</div>
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 14px;color:#1A1A1A;">${escapeHtml(title)}</h1>
    <div style="background:#F3EFE6;border:1px solid #d8d2c5;border-radius:6px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:12px;color:#524f49;text-transform:uppercase;letter-spacing:0.04em;">Reference ID</div>
      <div style="font-size:18px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#1F5C3F;margin-top:2px;">${escapeHtml(refId)}</div>
    </div>
    <p style="font-size:14px;line-height:1.5;color:#1A1A1A;margin:0 0 16px;">${escapeHtml(summary)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">${rowsHtml}</table>
    <p style="font-size:13px;line-height:1.45;color:#524f49;margin:0;border-top:1px solid #eceae4;padding-top:14px;">${escapeHtml(footerNote)}</p>
  </div>
</body></html>`;
}

function buildReceiptEmailText(title: string, refId: string, rows: ReceiptRow[], summary: string, footerNote: string): string {
  const lines = [
    "IDLE SPOT — " + title,
    "Reference ID: " + refId,
    "",
    summary,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    "",
    footerNote,
  ];
  return lines.join("\n");
}

async function sendReceiptAndOperatorEmails(params: {
  refId: string;
  kindTitle: string;
  userEmail: string | null;
  userRows: ReceiptRow[];
  operatorRows: ReceiptRow[];
  summary: string;
}): Promise<MailOutcome> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    return { email_configured: false, user_email_sent: false, operator_email_sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  const userFooter = "Zero payment on this page. Launching soon. Any money paid is fully refundable.";
  const tasks: Array<Promise<void>> = [];
  let userSent = false;
  let operatorSent = false;

  if (params.userEmail) {
    tasks.push(
      transporter
        .sendMail({
          from: `"Idle Spot" <${cfg.user}>`,
          to: params.userEmail,
          replyTo: cfg.notifyTo,
          subject: `Idle Spot Confirmation Receipt (${params.refId})`,
          text: buildReceiptEmailText(params.kindTitle, params.refId, params.userRows, params.summary, userFooter),
          html: buildReceiptEmailHtml(params.kindTitle, params.refId, params.userRows, params.summary, userFooter),
        })
        .then(() => {
          userSent = true;
        })
        .catch((err) => {
          console.error("Failed sending user receipt email:", err?.message || err);
        })
    );
  }

  if (cfg.notifyTo) {
    tasks.push(
      transporter
        .sendMail({
          from: `"Idle Spot Alerts" <${cfg.user}>`,
          to: cfg.notifyTo,
          subject: `[Idle Spot] New ${params.kindTitle} (${params.refId})`,
          text: buildReceiptEmailText(`New ${params.kindTitle}`, params.refId, params.operatorRows, params.summary, "Reply directly by phone/WhatsApp or email."),
          html: buildReceiptEmailHtml(`New ${params.kindTitle}`, params.refId, params.operatorRows, params.summary, "Reply directly by phone/WhatsApp or email."),
        })
        .then(() => {
          operatorSent = true;
        })
        .catch((err) => {
          console.error("Failed sending operator alert email:", err?.message || err);
        })
    );
  }

  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 6000));
  await Promise.race([Promise.all(tasks), timeoutPromise]);

  return {
    email_configured: true,
    user_email_sent: userSent,
    operator_email_sent: operatorSent,
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "250kb" }));

  // Never expose local store, server code, rules, or config files over HTTP (including in Vite dev mode)
  app.use((req: Request, res: Response, next) => {
    const p = req.path.toLowerCase();
    if (
      p === "/data" ||
      p.startsWith("/data/") ||
      p === "/server.ts" ||
      p === "/metadata.json" ||
      p === "/package.json" ||
      p === "/package-lock.json" ||
      p === "/vite.config.ts" ||
      p === "/tsconfig.json" ||
      p === "/eslint.config.js" ||
      p === "/firestore.rules" ||
      p === "/firestore.rules.test.ts" ||
      p === "/draft_firestore.rules" ||
      p === "/firebase-blueprint.json" ||
      p === "/security_spec.md" ||
      p.startsWith("/.env")
    ) {
      res.status(404).end("Not found");
      return;
    }
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Optional SMTP confirmation receipt & operator alert after Firestore save
  app.post("/api/notify-email", async (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const refId = cleanString(body.ref_id, 40);
    const kind = body.kind === "owner" ? "owner" : body.kind === "survey" ? "survey" : "driver";
    const rawEmail = cleanString(body.email, 160);
    const userEmail = rawEmail && isValidEmail(rawEmail) ? rawEmail : null;
    const summary = cleanString(body.summary, 600);
    const rawUserRows = Array.isArray(body.user_rows) ? body.user_rows : [];
    const rawOpRows = Array.isArray(body.operator_rows) ? body.operator_rows : [];

    const toRows = (arr: unknown[]): ReceiptRow[] =>
      arr
        .slice(0, 12)
        .map((item) => {
          const obj = (item || {}) as Record<string, unknown>;
          return {
            label: cleanString(obj.label, 80),
            value: cleanString(obj.value, 240),
          };
        })
        .filter((r) => r.label && r.value);

    if (!refId || !summary) {
      res.status(400).json({ ok: false, error: "Invalid email notification payload." });
      return;
    }

    const kindTitle =
      kind === "owner"
        ? "Space Listing Receipt"
        : kind === "survey"
        ? "Parking Survey Receipt"
        : "Parking Request Receipt";

    const outcome = await sendReceiptAndOperatorEmails({
      refId,
      kindTitle,
      userEmail,
      userRows: toRows(rawUserRows),
      operatorRows: toRows(rawOpRows),
      summary,
    });

    res.json({
      ok: true,
      email_configured: outcome.email_configured,
      email_sent: outcome.user_email_sent,
    });
  });

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: "Not found" });
  });

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
