export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
