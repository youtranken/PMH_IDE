import { assertEgressAllowed } from "../src/modules/notifications/egress.util";

// dns.lookup trên IP literal trả lại chính IP đó (không truy vấn mạng) → hermetic.
describe("egress SSRF guard", () => {
  const ok = (url: string, allow = "") =>
    expect(assertEgressAllowed(url, allow)).resolves.toMatchObject({
      address: expect.any(String),
    });
  const blocked = (url: string, allow = "") =>
    expect(assertEgressAllowed(url, allow)).rejects.toThrow();

  it("chỉ chấp nhận https", async () => {
    await blocked("http://8.8.8.8/hook");
    await ok("https://8.8.8.8/hook");
  });

  it("chặn metadata/link-local 169.254.169.254", () => blocked("https://169.254.169.254/x"));
  it("chặn private 10/8", () => blocked("https://10.0.0.5/x"));
  it("chặn private 192.168/16", () => blocked("https://192.168.1.1/x"));
  it("chặn private 172.16/12", () => blocked("https://172.16.5.5/x"));
  it("chặn loopback 127/8", () => blocked("https://127.0.0.1/x"));
  it("cho IP công khai", () => ok("https://93.184.216.34/x"));

  it("allowlist mở đúng dải private", async () => {
    await ok("https://10.1.2.3/x", "10.0.0.0/8");
    await ok("https://192.168.9.9/x", "192.168.0.0/16");
  });

  it("allowlist KHÔNG mở dải ngoài nó", () => blocked("https://10.1.2.3/x", "192.168.0.0/16"));

  it("URL sai định dạng → chặn", () => blocked("không-phải-url"));

  it("trả IP đã PIN để chống rebinding", async () => {
    const pin = await assertEgressAllowed("https://93.184.216.34/x", "");
    expect(pin.address).toBe("93.184.216.34");
    expect(pin.family).toBe(4);
  });

  // ===== IPv6 (L1): CIDR thật thay so-chuỗi-prefix =====
  it("chặn loopback ::1", () => blocked("https://[::1]/x"));
  it("chặn unspecified ::", () => blocked("https://[::]/x"));
  it("chặn link-local fe80::/10", () => blocked("https://[fe80::1]/x"));
  it("chặn ULA fc00::/7 (fc/fd)", async () => {
    await blocked("https://[fc00::1]/x");
    await blocked("https://[fd12:3456::1]/x");
  });
  it("chặn multicast ff00::/8", () => blocked("https://[ff02::1]/x"));
  it("chặn v4-mapped loopback ::ffff:127.0.0.1", () =>
    blocked("https://[::ffff:127.0.0.1]/x"));
  it("chặn v4-mapped private ::ffff:10.0.0.1", () =>
    blocked("https://[::ffff:10.0.0.1]/x"));
  it("chặn NAT64 64:ff9b:: (→ v4 nội bộ)", () =>
    blocked("https://[64:ff9b::10.0.0.1]/x"));
  it("cho IPv6 công khai", () => ok("https://[2606:4700:4700::1111]/x"));
  it("cho v4-mapped công khai ::ffff:93.184.216.34", () =>
    ok("https://[::ffff:93.184.216.34]/x"));
  it("allowlist v6 CIDR mở đúng ULA", async () => {
    await ok("https://[fd00::5]/x", "fd00::/8");
    await blocked("https://[fc00::5]/x", "fd00::/8"); // ngoài allowlist vẫn chặn
  });
});
