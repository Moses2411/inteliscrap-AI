export interface CameraConfig {
  facingMode: "environment" | "user";
  width: { ideal: number };
  height: { ideal: number };
}

export async function startCamera(
  videoElement: HTMLVideoElement,
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints[] = [
    { video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false },
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: true, audio: false },
  ];

  for (const constraint of constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      videoElement.srcObject = stream;
      await videoElement.play();
      return stream;
    } catch {
      // try next fallback
    }
  }

  throw new Error("No camera available");
}

export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
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
