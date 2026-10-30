import { Boxes, Code, LayoutDashboard, Rocket, Server, Smartphone } from "lucide-react";
import type { Product } from "@/types";

export const PRODUCT_ICON: Record<Product["type"], typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  shopify: Boxes,
  wordpress: Code,
  marketing: Rocket,
  sdk: Smartphone,
  api: Server,
};
