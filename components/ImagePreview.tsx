"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/hooks/useI18n";
import { isImeComposing } from "@/lib/ime";
import {
  fitImageView, imageViewCapabilities, panImageView, reconcileImageView, resetImageView,
  wheelImageView, zoomImageView,
  type ImageViewFit, type ImageViewTransform,
} from "@/lib/image-view-transform";

interface ImagePreviewProps {
  src: string;
  alt?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ImagePreview({ src, alt = "", children, className, style }: ImagePreviewProps) {
  const { t } = useI18n();
  const previewLabel = t("chat.previewImage");
  const triggerLabel = alt.trim() ? `${previewLabel}: ${alt}` : previewLabel;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        style={{ display: "block", padding: 0, border: "none", background: "none", color: "inherit", cursor: "zoom-in", ...style }}
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={previewLabel}
      >
        {children}
      </button>
      {/* A new source owns a fresh load/transform/drag lifecycle. Late events
          from the old image cannot enter the new preview, even at the same index. */}
      {open && createPortal(<ImagePreviewDialog key={src} src={src} alt={alt} triggerRef={triggerRef} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ImagePreviewDialog({ src, alt, triggerRef, onClose }: {
  src: string;
  alt: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [transform, setTransform] = useState(resetImageView);
  const transformRef = useRef<ImageViewTransform>(transform);
  const [fit, setFit] = useState<ImageViewFit | null>(null);
  const fitRef = useRef<ImageViewFit | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean; transform: ImageViewTransform } | null>(null);
  const actions = imageViewCapabilities(fit, transform);

  const applyTransform = (next: ImageViewTransform) => {
    transformRef.current = next;
    setTransform(next);
  };
  const measureImage = () => {
    const image = imageRef.current, viewport = viewportRef.current;
    if (!image || !viewport || !image.complete || image.getAttribute("src") !== src) return;
    const next = fitImageView(image.naturalWidth, image.naturalHeight, viewport.getBoundingClientRect());
    const nextTransform = reconcileImageView(transformRef.current, fitRef.current, next, src, src);
    fitRef.current = next;
    setFit(next);
    applyTransform(nextTransform);
    dragRef.current = null;
  };
  const handleImageError = () => {
    fitRef.current = null;
    setFit(null);
    applyTransform(resetImageView());
    dragRef.current = null;
    setLoadStatus("error");
  };
  const closePreview = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };
  const handleDoubleClick = (event: React.MouseEvent<HTMLImageElement>) => {
    const current = transformRef.current;
    const fit = fitRef.current;
    applyTransform(current.scale > 1 ? resetImageView() : zoomImageView(fit, current, fit?.maxScale ?? 1, { x: event.clientX, y: event.clientY }));
    dragRef.current = null;
  };
  const handleWheel = (event: WheelEvent) => {
    if (!fitRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? fitRef.current.viewport.height : 1);
    applyTransform(wheelImageView(fitRef.current, transformRef.current, delta, { x: event.clientX, y: event.clientY }));
    dragRef.current = null;
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    const actions = imageViewCapabilities(fitRef.current, transformRef.current);
    if (event.button !== 0 || dragRef.current || !(actions.panLeft || actions.panRight || actions.panUp || actions.panDown)) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, transform: transformRef.current };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    applyTransform(panImageView(fitRef.current, drag.transform, dx, dy));
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (isImeComposing(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePreview();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const fit = fitRef.current;
    const current = transformRef.current;
    const actions = imageViewCapabilities(fit, current);
    let next: ImageViewTransform | null = null;
    if ((event.key === "+" || event.key === "=") && actions.zoomIn) next = zoomImageView(fit, current, current.scale * 1.25);
    else if (event.key === "-" && actions.zoomOut) next = zoomImageView(fit, current, current.scale / 1.25);
    else if (event.key === "0" && actions.reset) next = resetImageView();
    else if (event.key === "ArrowLeft" && actions.panLeft) next = panImageView(fit, current, -40, 0);
    else if (event.key === "ArrowRight" && actions.panRight) next = panImageView(fit, current, 40, 0);
    else if (event.key === "ArrowUp" && actions.panUp) next = panImageView(fit, current, 0, -40);
    else if (event.key === "ArrowDown" && actions.panDown) next = panImageView(fit, current, 0, 40);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    applyTransform(next);
    dragRef.current = null;
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => measureImage();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener("resize", measure);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      viewport.removeEventListener("wheel", handleWheel);
    };
    // All reads use mounted refs; this dialog is keyed by src. Rebinding after
    // every wheel/drag update would drop in-progress pointer handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog ref={dialogRef} className="image-preview-dialog" aria-label={t("chat.previewImage")}
      data-image-scale={transform.scale} data-image-pan-x={transform.x} data-image-pan-y={transform.y}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); closePreview(); }}
      onKeyDown={handleKeyDown}
      onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}
    >
      <div ref={viewportRef} className="image-preview-viewport" aria-busy={loadStatus === "loading"}
        onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} className="image-preview-image" src={src} alt={alt} draggable={false}
          onLoad={() => { setLoadStatus("ready"); measureImage(); }} onError={handleImageError}
          onDoubleClick={handleDoubleClick} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onLostPointerCapture={() => { dragRef.current = null; }}
          style={{ width: fit?.width, height: fit?.height, visibility: fit ? "visible" : "hidden",
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            cursor: actions.panLeft || actions.panRight || actions.panUp || actions.panDown ? "grab" : "zoom-in" }}
        />
        {loadStatus === "error" && <div className="image-preview-error" role="alert">{t("chat.imageLoadFailed")}{alt && <span>{alt}</span>}</div>}
      </div>
      <div className="image-preview-controls">
        <button type="button" onClick={() => applyTransform(zoomImageView(fitRef.current, transformRef.current, transformRef.current.scale / 1.25))}
          disabled={!actions.zoomOut} aria-label={t("i18n.zoomOut")} title={t("i18n.zoomOut")} aria-keyshortcuts="-">−</button>
        <button type="button" className="image-preview-fit" onClick={() => applyTransform(resetImageView())}
          disabled={!actions.reset} aria-label={t("chat.resetImageView")} title={t("chat.resetImageView")} aria-keyshortcuts="0">{t("chat.resetImageView")}</button>
        <button type="button" onClick={() => applyTransform(zoomImageView(fitRef.current, transformRef.current, transformRef.current.scale * 1.25))}
          disabled={!actions.zoomIn} aria-label={t("i18n.zoomIn")} title={t("i18n.zoomIn")} aria-keyshortcuts="+">+</button>
      </div>
      <button ref={closeButtonRef} type="button" className="image-preview-close" onClick={closePreview}
        aria-label={t("chat.close")} title={t("chat.close")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </dialog>
  );
}
