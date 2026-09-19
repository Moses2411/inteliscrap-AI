"""Fine-tune a MobileNet-family classifier on scrap-material photos and export an int8 ONNX
model that matches the frontend inference contract in frontend/src/vision/visionEngine.ts.

Usage:
    python train.py --data ./data --out ../frontend/public/models/mobilenetv4_scrap_int8.onnx

Dataset layout (torchvision ImageFolder):
    data/train/<slug>/img.jpg
    data/val/<slug>/img.jpg
where <slug> is one of the 8 classes in frontend/public/models/classes.json:
    copper, aluminum, pet-plastic, lead-battery, brass, steel, e-waste, glass
The output tensor index N corresponds to classes.json[N].

Input contract the exported model must satisfy:
    float32 tensor [1, 3, 224, 224], RGB already normalized with
    mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225] (preprocessing is done in the browser).
"""

import argparse
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from tqdm import tqdm

EXPECTED_SLUGS = [
    "copper",
    "aluminum",
    "pet-plastic",
    "lead-battery",
    "brass",
    "steel",
    "e-waste",
    "glass",
]

PREP = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

TRAIN_PREP = transforms.Compose(
    [
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)


def build_model_backbone() -> nn.Module:
    try:
        import timm

        backbone = timm.create_model("mobilenetv4_conv_small_050", pretrained=True, num_classes=0)
        return nn.Sequential(backbone, nn.Linear(backbone.num_features, len(EXPECTED_SLUGS)))
    except Exception:
        import torchvision.models as tv

        model = tv.mobilenet_v3_small(weights=tv.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(EXPECTED_SLUGS))
        return model


def validate_class_order(data_root: Path) -> None:
    for split in ("train", "val"):
        split_dir = data_root / split
        if not split_dir.is_dir():
            continue
        found = sorted(p.name for p in split_dir.iterdir() if p.is_dir())
        missing = [slug for slug in EXPECTED_SLUGS if slug not in found]
        for slug in EXPECTED_SLUGS:
            d = split_dir / slug
            n = sum(1 for _ in d.glob("*.jpg")) + sum(1 for _ in d.glob("*.png")) + sum(1 for _ in d.glob("*.jpeg"))
            print(f"{split}/{slug}: {n} images")
        if missing:
            print(f"WARNING: {split} missing class folders: {missing}")


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    correct = total = 0
    for images, targets in loader:
        images, targets = images.to(device), targets.to(device)
        preds = model(images).argmax(dim=1)
        correct += (preds == targets).sum().item()
        total += targets.size(0)
    return correct / max(total, 1)


class ScrapDataset(Dataset):
    def __init__(self, root: Path, transform: transforms.Compose) -> None:
        self.samples: list[tuple[str, int]] = []
        for idx, slug in enumerate(EXPECTED_SLUGS):
            folder = root / slug
            if not folder.is_dir():
                continue
            images = sorted(
                list(folder.glob("*.jpg"))
                + list(folder.glob("*.jpeg"))
                + list(folder.glob("*.png"))
            )
            self.samples.extend((str(path), idx) for path in images)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, target = self.samples[index]
        return self.transform(Image.open(path).convert("RGB")), target


def main() -> int:
    parser = argparse.ArgumentParser(description="Train and export a scrap-material classifier")
    parser.add_argument("--data", type=Path, default=Path("data"), help="root folder holding train/ and val/")
    parser.add_argument("--out", type=Path, default=Path("../frontend/public/models/mobilenetv4_scrap_int8.onnx"))
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--device", type=str, default="auto")
    args = parser.parse_args()

    if not (args.data / "train").is_dir():
        print(f"ERROR: {args.data}/train does not exist. Put labeled photos in data/train/<slug>/ and data/val/<slug>/.")
        return 1

    device = (
        torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if args.device == "auto"
        else torch.device(args.device)
    )
    print(f"device: {device}")
    validate_class_order(args.data)

    train_set = ScrapDataset(args.data / "train", TRAIN_PREP)
    val_set = ScrapDataset(args.data / "val", PREP)
    if not len(train_set) or not len(val_set):
        print("ERROR: no images found under data/train/<slug>/ and data/val/<slug>/")
        return 1

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=0)

    model = build_model_backbone().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    best_acc = 0.0
    model_dir = args.data / "models"
    model_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for images, targets in tqdm(train_loader, desc=f"epoch {epoch}/{args.epochs}"):
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), targets)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * images.size(0)
        acc = evaluate(model, val_loader, device)
        print(f"epoch {epoch}: loss={total_loss / len(train_set):.4f} val_acc={(acc * 100):.2f}%")
        if acc >= best_acc:
            best_acc = acc
            torch.save(model.state_dict(), model_dir / "best.pth")
        if acc >= 0.97 and epoch >= 2:
            print("early stopping: val accuracy >= 97%")
            break

    model.load_state_dict(torch.load(model_dir / "best.pth", map_location=device))
    print(f"best val accuracy: {(best_acc * 100):.2f}%")

    model = build_model_backbone()
    model.load_state_dict(
        torch.load(model_dir / "best.pth", map_location="cpu"),
    )
    model.eval()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    fp32_path = args.out.with_suffix(".fp32.onnx")
    torch.onnx.export(
        model,
        torch.randn(1, 3, 224, 224),
        fp32_path,
        input_names=["pixel_values"],
        output_names=["logits"],
        opset_version=17,
        do_constant_folding=True,
    )

    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        quantize_dynamic(fp32_path, args.out, weight_type=QuantType.QInt8)
        fp32_path.unlink()
        print(f"exported int8 -> {args.out}")
    except Exception:
        fp32_path.rename(args.out)
        print(f"quantization skipped; exported fp32 -> {args.out}")

    print("classes order:", json.dumps(EXPECTED_SLUGS))
    return 0


if __name__ == "__main__":
    sys.exit(main())