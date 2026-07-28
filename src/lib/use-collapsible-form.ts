import { useEffect, useRef, useState } from "react";

// Shared behaviour for the "New / Log …" collapsible add-edit forms across the
// CRUD pages — the Clinicals feel, in one place:
//   • open  → smooth-scroll the form into view
//   • close → scroll back to wherever the opener button was when tapped
//   • after adding an item (the list above grows and pushes the form down) →
//     call scrollFormIntoView() to pull it back into view
export function useCollapsibleForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const prevScrollY = useRef(0);
  const didToggle = useRef(false);

  useEffect(() => {
    if (open) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (didToggle.current) {
      window.scrollTo({ top: prevScrollY.current, behavior: "smooth" });
    }
  }, [open]);

  function openForm() {
    prevScrollY.current = window.scrollY;
    didToggle.current = true;
    setOpen(true);
  }
  function closeForm() {
    didToggle.current = true;
    setOpen(false);
  }
  // Bring the (already-open) form back into view after a layout change —
  // e.g. right after adding a row when the form is kept open. Waits two frames
  // so the grown list has been laid out before we scroll.
  function scrollFormIntoView() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }),
    );
  }

  return { open, setOpen, formRef, openForm, closeForm, scrollFormIntoView };
}
