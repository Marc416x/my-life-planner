"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";

// Snap heights for the mobile bottom sheet (fractions of the viewport):
// opens at the lower one, drag up to the taller. Never full-screen.
const SNAP_POINTS: (number | string)[] = [0.5, 0.85];

/**
 * Responsive detail surface: a centered dialog on desktop, a snap-point
 * bottom sheet (swipe-to-dismiss) on mobile. Both give focus-trap, Escape,
 * tap-outside-to-close and scroll-lock via Base UI. Styling lives in the
 * `.sheet-*` / `.detail-dialog` / `.detail-sheet` rules in legacy/base.css.
 *
 * First extracted from the Clinicals page; reuse across the app for any
 * "compact card → detail" flow.
 */
export function DetailSheet({
  open, onOpenChange, title, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 640px)", { defaultMatches: false, noSsr: true });
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);

  // Reset to the lower snap height each time the sheet opens, using React's
  // "store previous value in state and adjust during render" pattern.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(SNAP_POINTS[0]);
  }

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} snapPoints={SNAP_POINTS} snapPoint={snap} onSnapPointChange={(sp) => setSnap(sp)}>
        <Drawer.Portal>
          <Drawer.Backdrop className="sheet-backdrop" />
          <Drawer.Viewport className="sheet-viewport">
            <Drawer.Popup className="detail-sheet">
              <div className="sheet-drag">
                <div className="sheet-grabber" />
                <Drawer.Title className="sheet-title">{title}</Drawer.Title>
              </div>
              <Drawer.Content className="sheet-scroll">{children}</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className="detail-dialog">
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
