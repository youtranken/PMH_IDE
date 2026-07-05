/**
 * oidc-provider v9 là pure-ESM; app compile ra CommonJS. tsc với module=CommonJS
 * sẽ dịch `import()` thành `require()` → crash ERR_REQUIRE_ESM. Bọc qua
 * `new Function` để giấu khỏi tsc — giữ nguyên dynamic import thật ở runtime
 * (AD-5, constraint interop).
 */
export const importEsm = new Function(
  "specifier",
  "return import(specifier)",
) as <T = unknown>(specifier: string) => Promise<T>;
