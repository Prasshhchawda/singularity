import { createFileRoute } from "@tanstack/react-router";
import KinetikPage from "../KinetikPage";

export const Route = createFileRoute("/")({
  component: KinetikPage,
});
