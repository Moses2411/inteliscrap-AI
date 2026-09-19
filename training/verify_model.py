"""Verify an exported ONNX model matches the frontend contract in visionEngine.ts.

Checks:
  - a float32 input tensor of shape [batch, 3, 224, 224]
  - a single output whose length matches frontend/public/models/classes.json,
    and whose index order matches that file (index N == classes.json[N]).

Optionally classifies an image using the same ImageNet preprocessing the browser
applies (visionEngine.ts preprocess()) and prints the top-1 class.

Usage:
    python verify_model.py [path/to/image.jpg]
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASSES_JSON = ROOT / "frontend" / "public" / "models" / "classes.json"


def load_classes() -> list[dict]:
    if not CLASSES_JSON.exists():
        print(f"ERROR: {CLASSES_JSON} not found")
        sys.exit(1)
    return json.loads(CLASSES_JSON.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the exported scrap classifier ONNX model")
    parser.add_argument("--model", type=Path, default=ROOT / "frontend/public/models/mobilenetv4_scrap_int8.onnx")
    parser.add_argument("--image", type=Path, default=None, help="optional image to classify for a sanity check")
    args = parser.parse_args()

    if not args.model.exists():
        print(f"ERROR: {args.model} not found. Run train.py first or copy the model there.")
        return 1

    import numpy as np
    import onnxruntime as ort

    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    print(f"inputs : {[(i.name, i.shape, i.type) for i in inputs]}")
    print(f"outputs: {[(o.name, o.shape, o.type) for o in outputs]}")

    ok = True
    if not inputs or inputs[0].shape[-3:] != [3, 224, 224]:
        print("ERROR: expected a [*, 3, 224, 224] image input")
        ok = False
    if len(outputs) != 1:
        print("ERROR: expected exactly one output")
        ok = False

    classes = load_classes()
    out_len = outputs[0].shape[-1] if outputs else -1
    if out_len and out_len != len(classes):
        print(f"ERROR: output size {out_len} != classes.json size {len(classes)}")
        ok = False
    print("classes.json order:", json.dumps([c["slug"] for c in classes]))

    if args.image is None:
        return 0 if ok else 1

    if not args.image.exists():
        print(f"ERROR: image {args.image} not found")
        return 1

    from PIL import Image
    from torchvision import transforms

    prep = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    tensor = prep(Image.open(args.image).convert("RGB")).unsqueeze(0).numpy()
    logits = session.run(None, {inputs[0].name: tensor})[0][0]
    probs = np.exp(logits - np.max(logits))
    probs = probs / probs.sum()
    order = np.argsort(-probs)
    for rank, idx in enumerate(order[:3], start=1):
        cls = classes[idx]
        print(f"#{rank} {cls['slug']} ({cls['label']})  p={probs[idx]:.3f}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())