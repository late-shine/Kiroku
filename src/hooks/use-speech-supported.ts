// Phase 16c: whether this browser can speak at all. It reads `window`, so it starts as false and settles after
// mount: the server render and the first client render then match, and the speaker buttons appear a moment later.
import { useEffect, useState } from "react";
import { isSpeechSupported } from "@/lib/voice";

export function useSpeechSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(isSpeechSupported()), []);
  return supported;
}
