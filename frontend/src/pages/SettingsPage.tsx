import { useState } from "react";
import { useApp } from "../store/appStore";

export default function SettingsPage() {
  const { selected_language, setSelectedLanguage, is_online } = useApp();
  const [testText, setTestText] = useState("");
  const [playing, setPlaying] = useState(false);

  const playTest = async () => {
    if (!testText.trim() || playing) return;
    setPlaying(true);

    try {
      const lang = selected_language === "ha" ? "ha" : "en";
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(testText)}&tl=${lang}&client=tw-ob`;

      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const audio = new Audio(blobUrl);
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(blobUrl); };
      audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(blobUrl); };
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

      <div className="card space-y-3">
        <label className="text-sm font-medium text-gray-700">Voice Language</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedLanguage("ha")}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
              selected_language === "ha"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Hausa (Hausa)
          </button>
          <button
            onClick={() => setSelectedLanguage("pcm")}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
              selected_language === "pcm"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Pidgin
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-sm font-medium text-gray-700">Test Voice</label>
          <p className="text-xs text-gray-500">
            {selected_language === "ha"
              ? "Rubuta magana don jin ta da muryar Hausa"
              : "Write something to hear it in Pidgin accent"}
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder={selected_language === "ha" ? "Sannu, yaya kake?" : "How you dey?"}
              onKeyDown={(e) => e.key === "Enter" && playTest()}
            />
            <button onClick={playTest} disabled={playing || !testText.trim()} className="btn-primary px-3">
              {playing ? "..." : "Play"}
            </button>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Connection</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className={`font-medium ${is_online ? "text-green-600" : "text-yellow-600"}`}>
            {is_online ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-medium text-gray-700">About</h3>
        <div className="space-y-1 text-sm text-gray-500">
          <p>InteliScrap AI v0.1.0</p>
          <p>Team Nexus — Build with Gemma Hackathon</p>
          <p>Edge AI for informal waste recyclers in Northern Nigeria</p>
        </div>
      </div>
    </div>
  );
}
