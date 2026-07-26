import { SITE_LINKS } from "@/lib/site-links";

const linkClass =
  "underline decoration-[color:var(--border-visible)] underline-offset-4 transition-colors hover:text-[color:var(--text-display)] hover:decoration-[color:var(--text-display)]";

/** Follow + star ask — landing + docs. */
export function SupportCta() {
  return (
    <section className="flex flex-col gap-3 border border-[color:var(--border-visible)] px-4 py-5">
      <p className="lab-label">If this helped</p>
      <p className="max-w-xl text-[length:var(--body)] leading-relaxed text-[color:var(--text-primary)]">
        If this helped you, drop a{" "}
        <a
          href={SITE_LINKS.follow}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          follow
        </a>{" "}
        and a{" "}
        <a
          href={SITE_LINKS.star}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          star on GitHub
        </a>
        ! I would really appreciate it.
      </p>
    </section>
  );
}
