import { createFileRoute, redirect } from "@tanstack/react-router";

/** The full chat page is retired: Foxgen AI now lives in the robot's pop-up on every page. */
export const Route = createFileRoute("/chat")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
