import { createFileRoute } from "@tanstack/react-router";
import { ErrorsPage } from "../pages/ErrorsPage";

export const Route = createFileRoute("/errors")({
  component: ErrorsPage,
});
