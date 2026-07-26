export async function register(): Promise<void> {
  // Skip edge; on Node (and when NEXT_RUNTIME is unset in Turbopack) init once.
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { setAppConfig } = await import("@service/core");

  const authPublic =
    process.env.AUTH_PUBLIC_API_URL ?? "http://127.0.0.1:8787/public/api";
  const accountPublic =
    process.env.ACCOUNT_PUBLIC_API_URL ?? "http://127.0.0.1:8787/public/api";
  const accountAdmin =
    process.env.ACCOUNT_ADMIN_API_URL ?? "http://127.0.0.1:8787/admin/api";

  setAppConfig({
    accountPublicApiUrl: accountPublic,
    accountAdminApiUrl: accountAdmin,
    oidc: {
      issuer: "https://auth.example.com",
      audience: "https://api.example.com",
      clientId: "esm-treeshake-lab-web",
      clientSecret: process.env.OIDC_CLIENT_SECRET ?? "replace-me",
      tokenEndpoint: `${authPublic}/oauth/token`,
      introspectEndpoint: `${authPublic}/oauth/introspect`,
      revokeEndpoint: `${authPublic}/oauth/revoke`,
      jwksUri: `${authPublic}/.well-known/jwks.json`,
    },
  });
}
