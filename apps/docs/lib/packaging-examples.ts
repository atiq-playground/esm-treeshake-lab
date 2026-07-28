export type PackagingLangId = "typescript" | "javascript";

export type PackagingLangExample = {
  id: PackagingLangId;
  label: string;
  /** Why this language belongs on the tab strip */
  why: string;
  bad: string;
  good: string;
};

/**
 * Same lesson per language: live bag / singleton keeps unused surface;
 * named surface + namespace import lets unused drop.
 * Only TS/JS — what this lab measures under esbuild.
 */
export const PACKAGING_EXAMPLES: PackagingLangExample[] = [
  {
    id: "typescript",
    label: "TypeScript",
    why: "ESM + bundler member shake (this lab)",
    bad: `// users.ts — live object bag
export const Users = {
  baseUrl: "",
  configure(cfg: { baseUrl: string }) {
    this.baseUrl = cfg.baseUrl;
  },
  getUser(id: string) {
    return fetch(\`\${this.baseUrl}/users/\${id}\`);
  },
  updateUser(id: string, body: unknown) {
    return fetch(\`\${this.baseUrl}/users/\${id}\`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};

// app.ts
import { Users } from "./users";
Users.configure({ baseUrl: "/api" });
Users.getUser("1");
// updateUser stays in the bundle`,
    good: `// users.ts — named exports only
let baseUrl = "";

export function configure(cfg: { baseUrl: string }) {
  baseUrl = cfg.baseUrl;
}

export function getUser(id: string) {
  // guards check: baseUrl set, id present
  return fetch(\`\${baseUrl}/users/\${id}\`);
}

export function updateUser(id: string, body: unknown) {
  // guards check: baseUrl set, id + body present
  return fetch(\`\${baseUrl}/users/\${id}\`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// app.ts — dotted call sites, unused can shake
import * as Users from "./users";
Users.configure({ baseUrl: "/api" });
Users.getUser("1");
// updateUser can be tree-shaken`,
  },
  {
    id: "javascript",
    label: "JavaScript",
    why: "Same ESM graph as TypeScript",
    bad: `// users.js — live object bag
export const Users = {
  baseUrl: "",
  configure(cfg) {
    this.baseUrl = cfg.baseUrl;
  },
  getUser(id) {
    return fetch(\`\${this.baseUrl}/users/\${id}\`);
  },
  updateUser(id, body) {
    return fetch(\`\${this.baseUrl}/users/\${id}\`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};

// app.js
import { Users } from "./users.js";
Users.configure({ baseUrl: "/api" });
Users.getUser("1");
// updateUser stays in the bundle`,
    good: `// users.js — named exports only
let baseUrl = "";

export function configure(cfg) {
  baseUrl = cfg.baseUrl;
}

export function getUser(id) {
  // guards check: baseUrl set, id present
  return fetch(\`\${baseUrl}/users/\${id}\`);
}

export function updateUser(id, body) {
  // guards check: baseUrl set, id + body present
  return fetch(\`\${baseUrl}/users/\${id}\`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// app.js — dotted call sites, unused can shake
import * as Users from "./users.js";
Users.configure({ baseUrl: "/api" });
Users.getUser("1");
// updateUser can be tree-shaken`,
  },
];
