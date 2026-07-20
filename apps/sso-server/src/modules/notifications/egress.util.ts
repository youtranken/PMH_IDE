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

function intToIpv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
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

/** IPv6 → số 128-bit (BigInt); mở rộng `::` + IPv4 nhúng ở đuôi. null nếu sai. */
function ipv6ToBigInt(ip: string): bigint | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%"); // bỏ zone-id (fe80::1%eth0)
  if (zone >= 0) s = s.slice(0, zone);
  // IPv4 nhúng ở đuôi (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) → đổi ra 2 nhóm hex.
  const v4m = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4m) {
    const v4 = ipv4ToInt(v4m[2]);
    if (v4 === null) return null;
    s = `${v4m[1]}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(Number.parseInt(g, 16));
  }
  return n;
}

/** IPv6 nằm trong CIDR "addr/len"? */
function v6InCidr(n: bigint, cidr: string): boolean {
  const [addr, lenStr] = cidr.trim().split("/");
  const base = ipv6ToBigInt(addr);
  const len = Number(lenStr);
  if (base === null || !Number.isInteger(len) || len < 0 || len > 128) return false;
  const shift = BigInt(128 - len);
  return n >> shift === base >> shift;
}

/** IPv4 nhúng trong v4-mapped (::ffff:0:0/96) hoặc NAT64 (64:ff9b::/96). */
function embeddedV4(n: bigint): number | null {
  if (v6InCidr(n, "::ffff:0:0/96") || v6InCidr(n, "64:ff9b::/96")) {
    return Number(n & 0xffffffffn);
  }
  return null;
}

// Dải IPv4 chặn mặc định (private, loopback, link-local/metadata, reserved).
const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
  "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4",
];

// Dải IPv6 chặn mặc định. `::/96` phủ unspecified `::`, loopback `::1`, và
// IPv4-compat `::a.b.c.d` (deprecated) trong một CIDR. v4-mapped/NAT64 tách v4
// riêng (embeddedV4) để allowlist v4 vẫn áp dụng.
const BLOCKED_V6 = ["::/96", "fe80::/10", "fc00::/7", "ff00::/8"];

function isBlocked(ip: string, family: number, allowlist: string[]): boolean {
  if (family === 4) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    if (allowlist.some((c) => c.includes(".") && v4InCidr(n, c))) return false;
    return BLOCKED_V4.some((c) => v4InCidr(n, c));
  }
  // IPv6: parse ra số 128-bit rồi kiểm CIDR thật (không so chuỗi prefix). Không
  // parse được → fail-closed (chặn). v4-mapped/NAT64 → kiểm phần v4 (allowlist v4
  // áp dụng). Allowlist v6 là CIDR thật.
  const n = ipv6ToBigInt(ip);
  if (n === null) return true;
  const emb = embeddedV4(n);
  if (emb !== null) return isBlocked(intToIpv4(emb), 4, allowlist);
  if (allowlist.some((c) => c.includes(":") && v6InCidr(n, c))) return false;
  return BLOCKED_V6.some((c) => v6InCidr(n, c));
}

export interface PinnedTarget {
  hostname: string;
  address: string; // IP đã validate — PIN kết nối vào đúng IP này
  family: number;
}

/**
 * Ném lỗi nếu URL webhook không an toàn; trả về IP đã validate để PIN (E7-S3
 * anti-DNS-rebinding): mọi IP resolve phải qua allow/block, và ta trả IP ĐẦU để
 * worker kết nối THẲNG vào đó (không resolve lại lúc gửi → kẻ không đổi DNS sang
 * IP nội bộ giữa validate và gửi được).
 */
export async function assertEgressAllowed(
  url: string,
  allowlistCidr: string,
): Promise<PinnedTarget> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("webhook_url không hợp lệ");
  }
  if (u.protocol !== "https:") throw new Error("webhook chỉ chấp nhận https");
  const host = u.hostname.replace(/^\[|\]$/g, ""); // bỏ [] của IPv6 literal
  const allow = allowlistCidr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ips = await lookup(host, { all: true });
  if (ips.length === 0) throw new Error("không resolve được host");
  for (const { address, family } of ips) {
    if (isBlocked(address, family, allow)) {
      throw new Error(`đích ${address} bị chặn (dải nội bộ, không trong allowlist)`);
    }
  }
  return { hostname: host, address: ips[0].address, family: ips[0].family };
}
