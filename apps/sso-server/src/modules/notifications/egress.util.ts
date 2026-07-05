import { lookup } from "node:dns/promises";

/**
 * Chống SSRF cho webhook (E7-S3, AD-14). Chỉ https; resolve host → chặn IP thuộc
 * dải private/loopback/link-local/metadata TRỪ khi nằm trong allowlist CIDR nội
 * bộ (app on-prem thật). Pin-IP/anti-rebinding (kết nối đúng IP đã kiểm) HOÃN
 * theo backlog — resolve-rồi-kiểm ở đây là lớp một.
 */

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const part of p) {
    const b = Number(part);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = (n << 8) | b;
  }
  return n >>> 0;
}

/** IPv4 nằm trong CIDR "a.b.c.d/len"? */
function v4InCidr(ipInt: number, cidr: string): boolean {
  const [addr, lenStr] = cidr.trim().split("/");
  const base = ipv4ToInt(addr);
  const len = Number(lenStr);
  if (base === null || !Number.isInteger(len) || len < 0 || len > 32) return false;
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

// Dải IPv4 chặn mặc định (private, loopback, link-local/metadata, reserved).
const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
  "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4",
];

function isBlocked(ip: string, family: number, allowlist: string[]): boolean {
  if (family === 4) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    if (allowlist.some((c) => c.includes(".") && v4InCidr(n, c))) return false;
    return BLOCKED_V4.some((c) => v4InCidr(n, c));
  }
  // IPv6 tối giản: chặn loopback ::1, link-local fe80::/10, ULA fc00::/7,
  // và IPv4-mapped ::ffff:x → kiểm phần v4. Allowlist v6 (prefix khớp chuỗi).
  const low = ip.toLowerCase();
  if (allowlist.some((c) => low.startsWith(c.split("/")[0].toLowerCase()))) return false;
  if (low === "::1") return true;
  if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true;
  if (low.startsWith("fc") || low.startsWith("fd")) return true;
  const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlocked(mapped[1], 4, allowlist);
  return false;
}

/** Ném lỗi nếu URL webhook không an toàn để gửi. */
export async function assertEgressAllowed(
  url: string,
  allowlistCidr: string,
): Promise<void> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("webhook_url không hợp lệ");
  }
  if (u.protocol !== "https:") throw new Error("webhook chỉ chấp nhận https");
  const allow = allowlistCidr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ips = await lookup(u.hostname, { all: true });
  if (ips.length === 0) throw new Error("không resolve được host");
  for (const { address, family } of ips) {
    if (isBlocked(address, family, allow)) {
      throw new Error(`đích ${address} bị chặn (dải nội bộ, không trong allowlist)`);
    }
  }
}
