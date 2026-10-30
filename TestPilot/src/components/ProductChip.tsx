import { useStore } from "@/store/useStore";
import { BRAND_TONE } from "@/lib/tone";
import { PRODUCT_ICON } from "@/lib/product";
import { Chip } from "@/components/ui/primitives";

export function ProductChip({ productId }: { productId: string }) {
  const product = useStore((s) => s.products.find((p) => p.id === productId));
  if (!product) return null;
  const Icon = PRODUCT_ICON[product.type];
  const tone = BRAND_TONE[product.brand];
  return (
    <Chip tone={tone} icon={<Icon size={12} />}>
      {product.name}
    </Chip>
  );
}

export function useFilteredByBrand<T extends { productId: string }>(items: T[]): T[] {
  const brand = useStore((s) => s.brand);
  const products = useStore((s) => s.products);
  if (brand === "all") return items;
  const ids = new Set(products.filter((p) => p.brand === brand).map((p) => p.id));
  return items.filter((i) => ids.has(i.productId));
}
