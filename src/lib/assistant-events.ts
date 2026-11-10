/** Any "Ask Foxgen AI" button opens the robot's chat pop-up through this one event. */
export const ASSISTANT_OPEN_EVENT = "foxgen:open-assistant";

export function openAssistant() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ASSISTANT_OPEN_EVENT));
}
