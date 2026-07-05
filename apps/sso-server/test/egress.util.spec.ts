import { assertEgressAllowed } from "../src/modules/notifications/egress.util";

// dns.lookup trên IP literal trả lại chính IP đó (không truy vấn mạng) → hermetic.
describe("egress SSRF guard", () => {
  const ok = (url: string, allow = "") =>
    expect(assertEgressAllowed(url, allow)).resolves.toBeUndefined();
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
});
