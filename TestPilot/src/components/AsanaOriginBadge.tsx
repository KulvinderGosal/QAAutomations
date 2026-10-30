import { ExternalLink } from "lucide-react";
import { AsanaLogo } from "@/components/icons/AsanaLogo";
import type { AsanaLink } from "@/types";

const ASANA_CORAL = "#F06A6A";
const ASANA_SURFACE = "oklch(0.96 0.03 20)";

// Compact "From Asana" chip. When `link` is provided and `asLink` is true it
// renders as an anchor to the Asana task.
export function AsanaOriginBadge({
  link,
  asLink = false,
  showExternal = false,
}: {
  link?: AsanaLink;
  asLink?: boolean;
  showExternal?: boolean;
}) {
  const content = (
    <>
      <AsanaLogo size={11} />
      From Asana
      {showExternal && <ExternalLink size={11} className="opacity-70" />}
    </>
  );
  const cls = "inline-flex items-center gap-1.5 rounded-chip px-2 py-[3px] text-[11.5px] font-semibold";
  const style = { color: ASANA_CORAL, background: ASANA_SURFACE };

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
