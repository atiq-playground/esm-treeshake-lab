/** Human-readable byte sizes for bench reports (binary units, 1024). */

export type ByteParts = {
  bytes: number;
  kb: number;
  mb: number;
  gb: number;
  /** Short primary label, e.g. `256.8 KB` */
  primary: string;
  /** Full conversion line, e.g. `262,986 B · 256.8 KB · 0.25 MB` */
  detail: string;
};

function trimNum(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return s.replace(/\.?0+$/, "");
}

export function byteParts(bytes: number): ByteParts {
  const kb = bytes / 1024;
  const mb = bytes / (1024 * 1024);
  const gb = bytes / (1024 * 1024 * 1024);

  let primary: string;
  if (bytes < 1024) {
    primary = `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    primary = `${trimNum(kb, 1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    primary = `${trimNum(mb, 2)} MB`;
  } else {
    primary = `${trimNum(gb, 2)} GB`;
  }

  // Include larger units once they round to a useful non-zero amount.
  const parts = [`${bytes.toLocaleString("en-US")} B`];
  if (bytes >= 1024) parts.push(`${trimNum(kb, 1)} KB`);
  if (mb >= 0.01) parts.push(`${trimNum(mb, 2)} MB`);
  if (gb >= 0.01) parts.push(`${trimNum(gb, 2)} GB`);

  return {
    bytes,
    kb: Number(kb.toFixed(3)),
    mb: Number(mb.toFixed(4)),
    gb: Number(gb.toFixed(6)),
    primary,
    detail: parts.join(" · "),
  };
}

export function formatBytes(bytes: number): string {
  return byteParts(bytes).primary;
}

export function formatBytesDetail(bytes: number): string {
  return byteParts(bytes).detail;
}
