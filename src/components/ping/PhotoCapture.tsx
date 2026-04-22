import { useEffect, useRef, useState } from "react";
import { useT_hook } from "@/store/usePingStore";

export type CaptureSlot = 1 | 2;

interface Props {
  slot: CaptureSlot;
  prompt: string;
  onCaptured: (blob: Blob, dataUrl: string) => void;
}

/**
 * Single-frame camera capture. Used twice in the two-photo flow:
 *  Photo 1: pill in hand
 *  Photo 2: empty hand (proof taken)
 *
 * Captures a JPEG via getUserMedia + canvas.toBlob.
 */
export function PhotoCapture({ slot, prompt, onCaptured }: Props) {
  const t = useT_hook();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "captured" | "denied">("idle");
  const [preview, setPreview] = useState<string | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("ready");
    } catch {
      setStatus("denied");
    }
  };

  useEffect(() => {
    start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = c.toDataURL("image/jpeg", 0.85);
        setPreview(dataUrl);
        setStatus("captured");
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        onCaptured(blob, dataUrl);
      },
      "image/jpeg",
      0.85,
    );
  };

  const retake = () => {
    setPreview(null);
    setStatus("idle");
    start();
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-black border border-border">
      <div className="bg-card text-foreground px-3 py-2 text-fs-xs font-bold border-b border-border">
        {t("photo_step")} {slot}/2 — {prompt}
      </div>
      <div className="relative aspect-video bg-black flex items-center justify-center">
        {preview ? (
          // Captured preview
          <img src={preview} alt={`Photo ${slot}`} className="w-full h-full object-cover" />
        ) : status === "denied" ? (
          <div className="text-white text-fs-xs p-4 text-center">{t("photo_denied")}</div>
        ) : (
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="p-2 bg-card border-t border-border flex gap-2">
        {status === "captured" ? (
          <button onClick={retake} className="flex-1 bg-input-bg text-foreground font-bold text-fs-xs py-2 rounded-lg">
            ↻ {t("photo_retake")}
          </button>
        ) : status === "denied" ? (
          <button onClick={start} className="flex-1 bg-green text-white font-bold text-fs-xs py-2 rounded-lg">
            {t("photo_grant")}
          </button>
        ) : (
          <button
            onClick={snap}
            disabled={status !== "ready"}
            className="flex-1 bg-green text-white font-bold text-fs-xs py-2 rounded-lg disabled:opacity-50"
          >
            📷 {t("photo_capture")}
          </button>
        )}
      </div>
    </div>
  );
}