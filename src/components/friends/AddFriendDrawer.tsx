import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { FriendsPanel } from "./FriendsPanel";
import { friendButton } from "./friends-ui";

/** Native top-layer focus trapping, portalled outside the transformed glass shell. */
export function AddFriendDrawer({
  requests,
  onClose,
  onReturnFocus,
}: {
  requests: number;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const returnFocus = useRef(onReturnFocus);
  returnFocus.current = onReturnFocus;
  useScrollLock();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else returnFocus.current();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="friends-drawer"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background p-4">
        <h2 id={title} className="font-display text-lg">
          Add friend · Requests ({requests})
        </h2>
        <button
          autoFocus
          type="button"
          className={friendButton}
          onClick={onClose}
          aria-label="Close Friends drawer"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p className="px-5 pt-4 text-xs text-muted-foreground">
        Friends see only what you choose to share.
      </p>
      <FriendsPanel managementOnly refreshOnOpen={false} />
    </dialog>,
    document.body,
  );
}
