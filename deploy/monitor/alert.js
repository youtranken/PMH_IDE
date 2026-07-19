/**
 * Cảnh báo mất-auth OUT-OF-BAND (E3-S3, AD-16). Chạy NGOÀI container (host
 * cron / Task Scheduler), KHÔNG dùng email worker của chính hệ (SSO chết thì
 * kênh đó chết cùng). Bắn Telegram khi /health lỗi hoặc scheduler/job kẹt.
 *
 *   HEALTH_URL=https://id.pmh.com.vn/api/health \
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node alert.js
 *
 * Không đặt TELEGRAM_* → chế độ DRY-RUN (in ra thay vì gửi). Exit 1 khi có
 * cảnh báo (để cron/monitor ngoài cũng bắt được).
 */
const https = require("node:https");
const http = require("node:http");

// Mặc định qua EDGE domain thật (cổng 9443 đã bỏ khi tách edge). Override bằng
// HEALTH_URL khi cần.
const HEALTH_URL = process.env.HEALTH_URL || "https://id.pmh.com.vn/api/health";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
// Dev self-signed → cho phép bỏ verify khi ALLOW_INSECURE=1 (prod KHÔNG)
const insecure = process.env.ALLOW_INSECURE === "1";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { timeout: 8000, rejectUnauthorized: !insecure },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, json: safeParse(body) }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
const safeParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

async function sendTelegram(text) {
  if (!TOKEN || !CHAT) {
    console.log("[DRY-RUN] sẽ gửi Telegram:\n" + text);
    return;
  }
  const data = JSON.stringify({ chat_id: CHAT, text });
  await new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 8000 },
      (res) => {
        res.resume();
        // Trước đây nuốt mọi phản hồi → token sai/chat sai/timeout đều "gửi
        // thành công" âm thầm, đúng kênh cuối cùng lại hỏng lặng lẽ. Giờ reject
        // khi Telegram từ chối để cron/monitor ngoài bắt được (exit != 0).
        res.on("end", () =>
          res.statusCode && res.statusCode < 300
            ? resolve()
            : reject(new Error(`Telegram HTTP ${res.statusCode}`)),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("Telegram timeout")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const problems = [];
  try {
    const { status, json } = await fetchJson(HEALTH_URL);
    if (status !== 200 || !json) {
      problems.push(`/health trả HTTP ${status}`);
    } else {
      if (json.status !== "ok") problems.push(`status=${json.status}`);
      if (json.db !== "up") problems.push(`DB ${json.db}`);
      if (json.provider !== "up") problems.push(`provider ${json.provider}`);
      if (json.scheduler && json.scheduler.alive === false)
        problems.push(`scheduler CHẾT (beat ${json.scheduler.lastBeatAgeSeconds}s)`);
      const sp = json.stalePending;
      if (sp && (sp.emailQueue > 0 || sp.webhooks > 0))
        problems.push(`job kẹt: email=${sp.emailQueue} webhook=${sp.webhooks}`);
      // Sự kiện đã BỎ HẲN (dead-letter) = MẤT — webhook 'khóa user' không giao
      // được sau hết retry. Cảnh báo để SSA requeue qua /admin/webhooks.
      const dl = json.deadLettered;
      if (dl && (dl.emailQueue > 0 || dl.webhooks > 0))
        problems.push(`ĐÃ BỎ (mất): email=${dl.emailQueue} webhook=${dl.webhooks}`);
    }
  } catch (e) {
    problems.push(`KHÔNG kết nối được /health: ${String(e.message || e)}`);
  }

  if (problems.length === 0) {
    console.log("OK — hệ thống auth khỏe.");
    process.exit(0);
  }
  const msg = `🚨 PMH ID CẢNH BÁO (${HEALTH_URL})\n- ${problems.join("\n- ")}`;
  await sendTelegram(msg);
  process.exit(1);
}
main();
