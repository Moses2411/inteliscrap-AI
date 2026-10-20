export interface CameraConfig {
  facingMode: "environment" | "user";
  width: { ideal: number };
  height: { ideal: number };
}

function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires HTTPS (or localhost). Open the app over https:// and try again.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not support camera access. Try an up-to-date Chrome, Safari, or Firefox.";
  }
  const name = (err as DOMException | undefined)?.name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was denied. Allow camera access in your browser settings, then retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    return "No camera was found on this device. You can still upload a photo instead.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is already in use by another app. Close it and retry.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "The selected camera doesn't meet the requirements. Try flipping the camera.";
    case "SecurityError":
      return "The browser blocked camera access for security reasons. Use https:// or localhost.";
    default:
      return "Camera access was blocked or no camera is available.";
  }
}

async function requestStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new DOMException("Insecure context", "SecurityError");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("getUserMedia unsupported", "NotSupportedError");
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function startCamera(
  videoElement: HTMLVideoElement,
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints[] = [
    { video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false },
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraint of constraints) {
    try {
      const stream = await requestStream(constraint);
      videoElement.srcObject = stream;
      await videoElement.play();
      return stream;
    } catch (err) {
      lastError = err;
      // Permission/security errors will fail every fallback — stop early.
      const name = (err as DOMException | undefined)?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || name === "NotSupportedError") break;
      // try next fallback
    }
  }

  throw new Error(cameraErrorMessage(lastError));
}

export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** Start the camera with an explicit front/rear preference (live scanner). */
export async function startCameraWithFacing(
  videoElement: HTMLVideoElement,
  facingMode: "environment" | "user",
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints[] = [
    {
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    },
    { video: { facingMode }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraint of constraints) {
    try {
      const stream = await requestStream(constraint);
      videoElement.srcObject = stream;
      await videoElement.play();
      return stream;
    } catch (err) {
      lastError = err;
      const name = (err as DOMException | undefined)?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || name === "NotSupportedError") break;
      // try next fallback
    }
  }

  throw new Error(cameraErrorMessage(lastError));
}

/** Whether the active video track exposes a controllable torch/flashlight. */
export function cameraTorchSupported(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0];
  const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
    torch?: boolean;
  };
  return Boolean(capabilities.torch);
}

/** Toggle the torch. Returns false when the device/stream cannot honour it. */
export async function setTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: on }],
    } as unknown as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

export async function captureFrame(videoElement: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}

export function readFileAsBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const blob = new Blob([reader.result!], { type: file.type });
      resolve(blob);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
