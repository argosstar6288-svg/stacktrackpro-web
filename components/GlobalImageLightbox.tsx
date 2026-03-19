"use client";

import { useEffect, useState } from "react";

type LightboxImage = {
  src: string;
  alt: string;
};

const MIN_CLICKABLE_IMAGE_SIZE = 72;

function isInteractiveAncestor(element: HTMLElement): boolean {
  return Boolean(element.closest("a, button, input, select, textarea, label, [role='button'], [data-no-image-zoom]"));
}

function getImageFromTarget(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof HTMLElement)) return null;

  if (target.tagName.toLowerCase() === "img") {
    return target as HTMLImageElement;
  }

  return target.closest("img");
}

export default function GlobalImageLightbox() {
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (lightboxImage) return;

      const image = getImageFromTarget(event.target);
      if (!image) return;

      if (image.closest("[data-global-image-lightbox]")) return;
      if (image.dataset.noImageZoom !== undefined) return;
      if (isInteractiveAncestor(image)) return;

      if (
        image.naturalWidth < MIN_CLICKABLE_IMAGE_SIZE ||
        image.naturalHeight < MIN_CLICKABLE_IMAGE_SIZE
      ) {
        return;
      }

      const src = image.currentSrc || image.src;
      if (!src) return;

      setLightboxImage({
        src,
        alt: image.alt || "Image preview",
      });
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [lightboxImage]);

  useEffect(() => {
    if (!lightboxImage) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxImage]);

  if (!lightboxImage) return null;

  return (
    <div
      data-global-image-lightbox
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 py-6"
      onClick={() => setLightboxImage(null)}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] rounded-2xl border border-white/15 bg-[#16110d] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-xl text-white transition hover:bg-black/75"
          onClick={() => setLightboxImage(null)}
          aria-label="Close image preview"
        >
          ×
        </button>
        <img
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          className="max-h-[82vh] max-w-[86vw] rounded-xl object-contain"
          loading="eager"
        />
      </div>
    </div>
  );
}