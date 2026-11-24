/** Any "Ask Foxgen AI" button opens the robot's chat pop-up through this one event. */
export const ASSISTANT_OPEN_EVENT = "foxgen:open-assistant";
/** Little cues for the mascot's face: a message was sent, the AI is typing, the answer arrived. */
export const ASSISTANT_SIGNAL_EVENT = "foxgen:assistant-signal";
export type AssistantSignal = "love" | "typing" | "answered";

export function openAssistant() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ASSISTANT_OPEN_EVENT));
}

export function signalAssistant(signal: AssistantSignal) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AssistantSignal>(ASSISTANT_SIGNAL_EVENT, { detail: signal }));
}
