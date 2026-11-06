import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { centeredBannerCrop, type BannerCrop } from "@/lib/banner-crop";
import {
  loadRetainedBanner,
  prepareBannerFile,
  type BannerDraft,
  type BannerScope,
  type BannerSource,
} from "@/lib/friend-banner";
import { BannerCropper } from "./BannerCropper";

type Editing = { decoded: BannerSource; source: string; crop: BannerCrop };
export function BannerEditor({
  draft,
  scope,
  disabled,
  storageError,
  active,
  accountMode,
  loading,
  loadError,
  removing,
  onLoad,
  onRemove,
  onChange,
  onCropActive,
}: {
  draft: BannerDraft | null;
  scope: BannerScope | null;
  disabled: boolean;
  storageError: string | null;
  active: boolean;
  accountMode: boolean;
  loading: boolean;
  loadError: string | null;
  removing: boolean;
  onLoad: (force?: boolean) => Promise<void>;
  onRemove: () => void;
  onChange: (value: BannerDraft, scope: BannerScope) => boolean;
  onCropActive: (value: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (active && accountMode) void onLoad(true);
  }, [active, accountMode, onLoad]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);
  const alive = useRef(true);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const onActiveRef = useRef(onCropActive);
  onActiveRef.current = onCropActive;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ++ticket.current;
      onActiveRef.current(false);
    };
  }, [scope]);
  useEffect(
    () => () => {
      editing?.decoded.close();
    },
    [editing],
  );
  useEffect(() => {
    onActiveRef.current(busy || editing !== null);
  }, [busy, editing]);
  const cancel = () => {
    ++ticket.current;
    setBusy(false);
    setEditing(null);
    setError(null);
  };
  const prepare = async (file?: File) => {
    const captured = scope;
    if (!captured || disabled) return;
    const sequence = ++ticket.current;
    setEditing(null);
    setBusy(true);
    setError(null);
    try {
      const result = file
        ? await prepareBannerFile(file)
        : draft
          ? { source: draft.source, decoded: await loadRetainedBanner(draft.source) }
          : null;
      if (!result) return;
      if (!alive.current || sequence !== ticket.current || scopeRef.current !== captured) {
        result.decoded.close();
        return;
      }
      setEditing({ ...result, crop: file ? centeredBannerCrop() : draft!.crop });
    } catch (reason) {
      if (alive.current && sequence === ticket.current && scopeRef.current === captured)
        setError(reason instanceof Error ? reason.message : "Couldn't open that banner.");
    } finally {
      if (alive.current && sequence === ticket.current && scopeRef.current === captured)
        setBusy(false);
    }
  };
  const picked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void prepare(file);
  };
  return (
    <div className="mt-4">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={picked}
        aria-label="Choose a banner image"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="studio-button studio-button-quiet"
          disabled={disabled || !scope || busy || loading}
          onClick={() => input.current?.click()}
        >
          {draft ? "Replace banner" : "Upload banner"}
        </button>
        {draft && !removing && (
          <button
            type="button"
            className="studio-button studio-button-quiet"
            disabled={disabled || !scope || busy || loading || removing}
            onClick={() => {
              void prepare();
            }}
          >
            Adjust crop
          </button>
        )}
        {draft && !removing && !draft.selected && (
          <button
            type="button"
            className="studio-button studio-button-quiet"
            disabled={disabled || !scope || busy || loading || removing}
            onClick={() => {
              if (scope) onChange({ ...draft, selected: true }, scope);
            }}
          >
            Use uploaded banner
          </button>
        )}
        {(draft || loadError) && !removing && (
          <button
            type="button"
            className="studio-button studio-button-quiet"
            disabled={disabled || busy || loading}
            onClick={() => {
              cancel();
              onRemove();
            }}
          >
            Remove upload
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {removing
          ? "Save look to remove the upload from your account. Discard keeps it."
          : accountMode
            ? "JPEG, PNG or WebP, up to 20 MB. Save look keeps the editable banner privately. Friends receive only its selected crop while sharing is on."
            : "JPEG, PNG or WebP, up to 20 MB. Your banner stays on this device."}
      </p>
      {loading && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Loading your saved banner…
        </p>
      )}
      {loadError && (
        <div className="mt-2 text-xs text-destructive" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="studio-text-button"
            disabled={disabled || loading}
            onClick={() => void onLoad(true)}
          >
            Retry saved banner
          </button>
        </div>
      )}
      {busy && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
        >
          Preparing banner…
          <button type="button" className="studio-text-button" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {storageError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {storageError}
        </p>
      )}
      {editing && (
        <BannerCropper
          disabled={disabled}
          source={editing.decoded}
          initialCrop={editing.crop}
          onCancel={cancel}
          onSave={({ data, crop }) => {
            if (!scope || scopeRef.current !== scope || !alive.current || disabled) return;
            onChange(
              { v: 1, uid: scope.uid, source: editing.source, data, crop, selected: true },
              scope,
            );
            ++ticket.current;
            setEditing(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
