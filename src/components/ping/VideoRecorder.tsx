import { useEffect, useRef, useState } from "react";

/**
 * Tiny in-modal video recorder. Records up to maxSeconds (default 10s) of webm
 * via MediaRecorder, then exposes the Blob. Falls back gracefully when camera
 * is denied / unavailable — caller can still confirm without a video.
 */
export function VideoRecorder({
  maxSeconds = 10,
  onBlob,
}: {
  maxSeconds?: number;
  onBlob: (blob: Blob | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "recording" | "done" | "denied">("idle");
  const [secsLeft, setSecsLeft] = useState(maxSeconds);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setStatus("done");
      onBlob(blob);
      stopStream();
    };
    rec.start();
    setStatus("recording");
    setSecsLeft(maxSeconds);
    const tick = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const retry = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onBlob(null);
    setStatus("idle");
    // re-init
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    })();
  };

  if (status === "denied") {
    return (
      <div className="bg-amber-l border border-amber rounded-xl p-3 text-fs-xs text-amber font-bold text-center">
        📷 Camera unavailable. You can still confirm without video.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
      {status !== "done" ? (
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      ) : (
        previewUrl && <video src={previewUrl} className="w-full h-full object-cover" controls playsInline />
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent">
        {status === "ready" && (
          <button
            onClick={start}
            className="bg-red text-white font-extrabold text-fs-xs px-4 py-2 rounded-full"
          >
            ● Record
          </button>
        )}
        {status === "recording" && (
          <button
            onClick={stop}
            className="bg-white text-red font-extrabold text-fs-xs px-4 py-2 rounded-full"
          >
            ■ Stop ({secsLeft}s)
          </button>
        )}
        {status === "done" && (
          <button
            onClick={retry}
            className="bg-white text-foreground font-bold text-fs-xs px-4 py-2 rounded-full"
          >
            ↻ Retake
          </button>
        )}
      </div>
    </div>
  );
}
