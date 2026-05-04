import { useEffect } from "react";

/**
 * Full-screen image viewer. Click backdrop or close button to dismiss.
 * Uses object-contain so the FULL image is visible without cropping.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[700] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white text-fs-base font-bold rounded-full w-10 h-10 flex items-center justify-center"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg"
      />
    </div>
  );
}