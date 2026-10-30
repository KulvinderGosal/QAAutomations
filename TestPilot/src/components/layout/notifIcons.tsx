import type { ComponentType } from "react";
import { CheckCheck, FileWarning, MessageSquare, UserPlus } from "lucide-react";
import { AsanaLogo } from "@/components/icons/AsanaLogo";
import { SlackLogo } from "@/components/icons/SlackLogo";
import { GithubMark } from "@/components/icons/GithubMark";
import type { NotificationKind } from "@/types";

type NotifIcon = ComponentType<{ size?: number; className?: string }>;

export const NOTIF_ICON: Record<NotificationKind, NotifIcon> = {
  assignment: UserPlus,
  "asana-assignment": AsanaLogo,
  "slack-assignment": SlackLogo,
  "github-assignment": GithubMark,
  "dev-comment": MessageSquare,
  verified: CheckCheck,
  "issue-filed": FileWarning,
};
