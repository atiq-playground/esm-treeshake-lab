import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/brand-icons";
import {
  SearchFullWithStars,
  SearchSmWithStars,
} from "@/components/search-with-stars";
import { SITE_LINKS } from "@/lib/site-links";

const externalLinks: LinkItemType[] = [
  {
    text: "Portfolio",
    url: SITE_LINKS.portfolio,
    external: true,
    secondary: true,
  },
  {
    type: "icon",
    label: "GitHub",
    text: "GitHub",
    icon: <GitHubIcon />,
    url: SITE_LINKS.githubProfile,
    external: true,
    secondary: true,
  },
  {
    type: "icon",
    label: "LinkedIn",
    text: "LinkedIn",
    icon: <LinkedInIcon />,
    url: SITE_LINKS.linkedin,
    external: true,
    secondary: true,
  },
  {
    type: "icon",
    label: "X",
    text: "X",
    icon: <XIcon />,
    url: SITE_LINKS.x,
    external: true,
    secondary: true,
  },
];

const searchTriggerSlots = {
  full: SearchFullWithStars,
  sm: SearchSmWithStars,
};

function shared(docLinks: LinkItemType[]): BaseLayoutProps {
  return {
    nav: {
      title: "ESM TREE-SHAKE LAB",
    },
    links: [...docLinks, ...externalLinks],
    slots: {
      searchTrigger: searchTriggerSlots,
    },
  };
}

/** Home: Metrics + docs pages in the top nav / mobile menu. */
export function baseOptions(): BaseLayoutProps {
  return shared([
    { text: "Metrics", url: "/" },
    { text: "Why", url: "/docs/why" },
    { text: "Run", url: "/docs/run" },
    { text: "Research", url: "/docs/research" },
  ]);
}

/** Docs: page tree owns Why/Run/Research; don't duplicate them in `links`. */
export function docsOptions(): BaseLayoutProps {
  return shared([{ text: "Metrics", url: "/" }]);
}
