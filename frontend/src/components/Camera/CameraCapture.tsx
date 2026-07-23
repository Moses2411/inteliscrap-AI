import { useRef, useState, useCallback } from "react";
import { startCamera, stopCamera, captureFrame, readFileAsBlob } from "../../services/camera";
import { useTranslation } from "../../hooks/useTranslation";

interface Props {
  onImageCapture: (blob: Blob) => void;
  disabled?: boolean;
}

export default function CameraCapture({ onImageCapture, disabled }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activateCamera = useCallback(async () => {
    setError(null);
    try {
      // Wait a tick for the hidden video element to mount in DOM
      await new Promise((r) => setTimeout(r, 50));
      const el = videoRef.current;
      if (!el) throw new Error("Video element not found");

      const stream = await startCamera(el);
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      setError(t("camera_unavailable"));
    }
  }, [t]);

  const capture = useCallback(async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    try {
      const blob = await captureFrame(videoRef.current);
      if (blob) onImageCapture(blob);
    } finally {
      setCapturing(false);
    }
  }, [capturing, onImageCapture]);

  const deactivateCamera = useCallback(() => {
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    setCameraActive(false);
    setError(null);
  }, []);

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCapturing(true);
      try {
        const blob = await readFileAsBlob(file);
        onImageCapture(blob);
      } finally {
        setCapturing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onImageCapture]
  );

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        {/* Video always in DOM so ref exists — hidden via absolute positioning when inactive */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-[3/4] w-full object-cover ${cameraActive ? "relative" : "absolute h-0 w-0 opacity-0 pointer-events-none"}`}
        />

        {!cameraActive && (
          <div className="flex flex-col items-center justify-center gap-4 bg-gray-900 px-4 py-12">
            <svg className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <div className="flex flex-col gap-2">
              <button
                onClick={activateCamera}
                disabled={disabled}
                className="btn-primary gap-2"
              >
                {t("open_camera")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="btn-secondary gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {t("upload_image")}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
        )}

        {cameraActive && (
          <>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4 px-4">
              <button
                onClick={capture}
                disabled={capturing || disabled}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-white/80"
              >
                <div className="h-12 w-12 rounded-full border-2 border-gray-800" />
              </button>
            </div>
            <button
              onClick={deactivateCamera}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="text-center text-xs text-yellow-600">{error}</p>
      )}
    </div>
  );
}
