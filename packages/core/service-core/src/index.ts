import "server-only";

export type OidcClientConfig = {
  issuer: string;
  audience: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  introspectEndpoint: string;
  revokeEndpoint: string;
  jwksUri: string;
};

export type AppConfig = {
  accountPublicApiUrl: string;
  accountAdminApiUrl: string;
  oidc: OidcClientConfig;
};

const APP_CONFIG_KEY = Symbol.for("@service/core/appConfig");

type GlobalConfigStore = typeof globalThis & {
  [APP_CONFIG_KEY]?: AppConfig;
};

export function setAppConfig(config: AppConfig): void {
  // Process-global so instrumentation init survives Next/Turbopack HMR of this module.
  (globalThis as GlobalConfigStore)[APP_CONFIG_KEY] = config;
}

export function getAppConfig(): AppConfig {
  const appConfig = (globalThis as GlobalConfigStore)[APP_CONFIG_KEY];
  if (!appConfig) {
    throw new Error(
      "@service/core: app config is not set (initialize in instrumentation.ts)",
    );
  }
  return appConfig;
}

/** Explicit Bearer header value — never ambient/module-scoped. */
export function bearerAuthorization(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

/** Absolute URL (or path already resolved by the caller) + fetch. No ambient auth. */
export async function request(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  getAppConfig();
  return fetch(url, init);
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
