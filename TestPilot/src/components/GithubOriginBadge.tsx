import { ExternalLink } from "lucide-react";
import { GithubMark } from "@/components/icons/GithubMark";
import type { GithubLink } from "@/types";

const GH_FG = "#1f2328";
const GH_SURFACE = "oklch(0.94 0 0)";

// Compact "From GitHub" chip. When `link` is provided and `asLink` is true it
// renders as an anchor to the issue.
export function GithubOriginBadge({
  link,
  asLink = false,
  showExternal = false,
}: {
  link?: GithubLink;
  asLink?: boolean;
  showExternal?: boolean;
}) {
  const content = (
    <>
      <GithubMark size={11} />
      {link ? `#${link.number}` : "From GitHub"}
      {showExternal && <ExternalLink size={11} className="opacity-70" />}
    </>
  );
  const cls = "inline-flex items-center gap-1.5 rounded-chip px-2 py-[3px] text-[11.5px] font-semibold";
  const style = { color: GH_FG, background: GH_SURFACE };

  if (asLink && link) {
    return (
      <a href={link.url} target="_blank" rel="noreferrer" className={`${cls} hover:brightness-95`} style={style}>
        {content}
      </a>
    );
  }
  return (
    <span className={cls} style={style}>
      {content}
    </span>
  );
}
