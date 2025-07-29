import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "../pages/ProductDetailPage";

export const Route = createFileRoute("/product/$productId")({
  component: ProductDetailPage,
});
