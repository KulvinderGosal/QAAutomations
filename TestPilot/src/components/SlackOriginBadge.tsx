import { ExternalLink } from "lucide-react";
import { SlackLogo } from "@/components/icons/SlackLogo";
import type { SlackLink } from "@/types";

const SLACK_AUBERGINE = "#611f69";
const SLACK_SURFACE = "oklch(0.95 0.02 320)";

// Compact "From Slack" chip. When `link` is provided and `asLink` is true it
// renders as an anchor to the Slack message.
export function SlackOriginBadge({
  link,
  asLink = false,
  showExternal = false,
}: {
  link?: SlackLink;
  asLink?: boolean;
  showExternal?: boolean;
}) {
  const content = (
    <>
      <SlackLogo size={11} />
      From Slack
      {showExternal && <ExternalLink size={11} className="opacity-70" />}
    </>
  );
  const cls = "inline-flex items-center gap-1.5 rounded-chip px-2 py-[3px] text-[11.5px] font-semibold";
  const style = { color: SLACK_AUBERGINE, background: SLACK_SURFACE };

  if (asLink && link) {
    return (
      <a href={link.permalink} target="_blank" rel="noreferrer" className={`${cls} hover:brightness-95`} style={style}>
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
