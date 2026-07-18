// Member 3 — Edge AI & Local ML Engineer
// Web Worker that hosts the WebLLM MLCEngine for Gemma inference

import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
