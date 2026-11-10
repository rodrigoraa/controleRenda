import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal as MantineModal } from "@mantine/core";
import "../ui/forms.css";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);

  useLayoutEffect(() => {
    if (!surface) return;
    closeRef.current?.focus({ preventScroll: true });
    let portal: HTMLElement = surface;
    while (portal.parentElement && portal.parentElement !== document.body)
      portal = portal.parentElement;
    const background = Array.from(document.body.children)
      .filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          node !== portal &&
          !node.hasAttribute("data-portal"),
      )
      .map((node) => ({
        node,
        inert: node.inert,
        hidden: node.getAttribute("aria-hidden"),
      }));
    background.forEach(({ node }) => {
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
    });
    return () => {
      background.forEach(({ node, inert, hidden }) => {
        node.inert = inert;
        if (hidden === null) node.removeAttribute("aria-hidden");
        else node.setAttribute("aria-hidden", hidden);
      });
      if (previousFocus.current?.isConnected)
        previousFocus.current.focus({ preventScroll: true });
    };
  }, [surface]);

  useEffect(() => {
    if (!surface) return;
    const root = surface.closest<HTMLElement>(".cr-modal-root");
    const viewport = window.visualViewport;
    const fitViewport = () => {
      root?.style.setProperty(
        "--cr-dialog-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root?.style.setProperty(
        "--cr-dialog-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      root?.toggleAttribute(
        "data-keyboard-open",
        !!viewport && window.innerHeight - viewport.height > 120,
      );
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
    };
  }, [surface]);

  return (
    <MantineModal.Root
      opened
      onClose={onClose}
      centered
      trapFocus
      returnFocus={false}
      closeOnEscape
      closeOnClickOutside
      lockScroll
      size={wide ? 650 : 540}
      zIndex="var(--cr-z-dialog, 600)"
      transitionProps={{ duration: 0 }}
      classNames={{
        root: "cr-modal-root",
        inner: "cr-modal-inner",
        content: "cr-modal-content",
        header: "cr-modal-header",
        title: "cr-modal-title",
        body: "cr-modal-body",
        close: "cr-modal-close",
        overlay: "cr-modal-overlay",
      }}
    >
      <MantineModal.Overlay backgroundOpacity={0.48} blur={3} />
      <MantineModal.Content ref={setSurface}>
        <MantineModal.Header>
          <div className="cr-modal-heading">
            <MantineModal.Title>{title}</MantineModal.Title>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <MantineModal.CloseButton
            ref={closeRef}
            data-autofocus
            aria-label="Fechar janela"
          />
        </MantineModal.Header>
        <MantineModal.Body>{children}</MantineModal.Body>
      </MantineModal.Content>
    </MantineModal.Root>
  );
}
