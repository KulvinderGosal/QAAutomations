import { Ban, CircleCheckBig, CircleDashed, CircleX, LoaderCircle, MinusCircle } from "lucide-react";
import type { QaStageStatus } from "@/types";
import { QA_STAGE_TONE } from "@/lib/tone";

export function QaStageIcon({ status, size = 16 }: { status: QaStageStatus; size?: number }) {
  const style = { color: QA_STAGE_TONE[status].color };
  switch (status) {
    case "done":
      return <CircleCheckBig size={size} style={style} />;
    case "active":
      return <LoaderCircle size={size} className="cp-spin" style={style} />;
    case "failed":
      return <CircleX size={size} style={style} />;
    case "paused":
      return <Ban size={size} style={style} />;
    case "skipped":
      return <MinusCircle size={size} style={style} />;
    default:
      return <CircleDashed size={size} style={style} />;
  }
}
