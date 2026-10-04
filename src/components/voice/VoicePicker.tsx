import { useState } from "react";
import { Check, Volume2 } from "lucide-react";
import {
  VOICE_SAMPLE_TEXT,
  isSpeechSupported,
  loadVoicePref,
  saveVoicePref,
  speak,
  useJapaneseVoices,
} from "@/lib/voice";

/** Phase 8: pick which browser voice reads Japanese aloud. Tapping a row saves it and plays a sample. */
export function VoicePicker() {
  const { voices, settled } = useJapaneseVoices();
  const [savedUri, setSavedUri] = useState(loadVoicePref);

  const heading = (
    <>
      <span className="font-display text-xs italic text-primary">声 · voice</span>
      <h2 className="mt-3 font-display text-2xl">Choose who reads Japanese aloud</h2>
    </>
  );

  if (!isSpeechSupported()) {
    return (
      <div>
        {heading}
        <p className="mt-4 text-sm text-muted-foreground">
          This browser can't read text aloud, so the Listen buttons won't make any sound here.
        </p>
      </div>
    );
  }

  // A saved voice this browser doesn't have (another device, or uninstalled) behaves as Automatic.
  // The saved value is kept, in case the voice returns.
  const effectiveUri = voices.some((v) => v.voiceURI === savedUri) ? savedUri : "";
  const savedButMissing = settled && savedUri !== "" && effectiveUri === "";

  const choose = (uri: string) => {
    saveVoicePref(uri);
    setSavedUri(uri);
    speak(VOICE_SAMPLE_TEXT);
  };

  return (
    <div>
      {heading}
      <p className="mt-2 text-xs text-muted-foreground">
        Tap a voice to select it and hear a sample. Every Listen button in the app will use it.
      </p>
      {savedButMissing && (
        <p className="mt-3 text-xs text-muted-foreground">
          Your saved voice isn't available in this browser, so the default Japanese voice is being
          used.
        </p>
      )}
      {settled && voices.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No Japanese voices were found on this device. Kiroku will use the browser's default.
          Installing a Japanese voice in your system's speech settings will make it show up here.
        </p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          <li>
            <VoiceRow
              selected={effectiveUri === ""}
              title="Automatic"
              detail="Let the browser choose a Japanese voice"
              onPick={() => choose("")}
            />
          </li>
          {voices.map((voice) => (
            <li key={voice.voiceURI}>
              <VoiceRow
                selected={effectiveUri === voice.voiceURI}
                title={voice.name}
                detail={`${voice.lang} · ${voice.localService ? "on this device" : "online"}`}
                onPick={() => choose(voice.voiceURI)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VoiceRow({
  selected,
  title,
  detail,
  onPick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      {selected ? (
        <Check className="size-4 shrink-0 text-primary" />
      ) : (
        <Volume2 className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
