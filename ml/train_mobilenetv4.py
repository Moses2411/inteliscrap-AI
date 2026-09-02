#!/usr/bin/env python3
"""Fine-tune a MobileNetV4 backbone on scrap images and export an INT8 ONNX model
for on-device inference via onnxruntime-web (visionEngine.ts).

Dataset layout (one folder per class, folder name == class slug):
    data/
        copper/
        aluminum/
        pet-plastic/
        lead-battery/
        ...

Usage:
    pip install -r ml/requirements-ml.txt
    python ml/train_mobilenetv4.py \
        --data-dir data \
        --epochs 10 \
        --batch-size 32 \
        --output frontend/public/models

Outputs (into --output):
    mobilenetv4_scrap_int8.onnx   # quantized model (~10 MB)
    mobilenetv4_scrap_fp32.onnx   # unquantized reference
    classes.json                  # index -> {label, slug, hazardLevel}
"""

import argparse
import json
import os

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset, random_split
from torchvision import transforms as T
from torchvision.datasets import ImageFolder

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
DEFAULT_BACKBONE = "mobilenetv4_conv_small"
DEFAULT_LABELS = os.path.join(os.path.dirname(__file__), "labels.json")


def parse_args():
    p = argparse.ArgumentParser(description="Train and export MobileNetV4 scrap classifier")
    p.add_argument("--data-dir", required=True, help="root folder with one subfolder per class")
    p.add_argument("--output", default="frontend/public/models", help="output directory")
    p.add_argument("--backbone", default=DEFAULT_BACKBONE)
    p.add_argument("--labels", default=DEFAULT_LABELS, help="JSON mapping slug -> {label, hazardLevel}")
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--img-size", type=int, default=224)
    p.add_argument("--val-split", type=float, default=0.2)
    p.add_argument("--calib-samples", type=int, default=128)
    p.add_argument("--seed", type=int, default=0)
    return p.parse_args()


def slugify(folder_name: str) -> str:
    return folder_name.strip().lower().replace(" ", "-")


def load_label_map(path: str) -> dict:
    if path and os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def make_transforms(img_size: int):
    train = T.Compose([
        T.RandomResizedCrop(img_size, scale=(0.7, 1.0)),
        T.RandomHorizontalFlip(),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    val = T.Compose([
        T.Resize(int(img_size * 1.14)),
        T.CenterCrop(img_size),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    return train, val


def build_model(backbone: str, num_classes: int) -> nn.Module:
    import timm

    return timm.create_model(backbone, pretrained=True, num_classes=num_classes)


def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
        correct += (logits.argmax(1) == labels).sum().item()
        total += images.size(0)
    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    correct, total = 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        logits = model(images)
        correct += (logits.argmax(1) == labels).sum().item()
        total += images.size(0)
    return correct / total


def export_onnx(model, path, img_size, device):
    model.eval().to("cpu")
    dummy = torch.randn(1, 3, img_size, img_size)
    torch.onnx.export(
        model,
        dummy,
        path,
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        do_constant_folding=True,
    )
    _ = device


def quantize_int8(fp32_path, int8_path, calibration_loader):
    from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static

    class Reader(CalibrationDataReader):
        def __init__(self, loader):
            self.it = iter(loader)

        def get_next(self):
            try:
                images, _ = next(self.it)
                return {"input": images.numpy()}
            except StopIteration:
                return None

    quantize_static(
        fp32_path,
        int8_path,
        Reader(calibration_loader),
        quant_format=QuantFormat.QOperator,
        weight_type=QuantType.QInt8,
        activation_type=QuantType.QUInt8,
    )


def main():
    args = parse_args()
    torch.manual_seed(args.seed)

    train_tf, val_tf = make_transforms(args.img_size)
    dataset = ImageFolder(args.data_dir, transform=train_tf)

    labels = load_label_map(args.labels)

    classes = []
    for folder in dataset.classes:
        slug = slugify(folder)
        meta = labels.get(slug, {})
        classes.append({
            "label": meta.get("label", folder),
            "slug": slug,
            "hazardLevel": meta.get("hazardLevel", "low"),
        })

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_model(args.backbone, len(dataset.classes)).to(device)

    val_size = max(1, int(len(dataset) * args.val_split))
    train_size = len(dataset) - val_size
    gen = torch.Generator().manual_seed(args.seed)
    train_indices, val_indices = random_split(
        list(range(len(dataset))), [train_size, val_size], generator=gen
    )

    train_ds = Subset(ImageFolder(args.data_dir, transform=train_tf), train_indices.indices)
    val_ds = Subset(ImageFolder(args.data_dir, transform=val_tf), val_indices.indices)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=2)
    calib_loader = DataLoader(Subset(val_ds, range(min(len(val_ds), args.calib_samples))), batch_size=1)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

    for epoch in range(1, args.epochs + 1):
        loss, acc = train_one_epoch(model, train_loader, optimizer, criterion, device)
        val_acc = evaluate(model, val_loader, device)
        print(f"epoch {epoch:02d}/{args.epochs}  loss {loss:.4f}  acc {acc:.3f}  val_acc {val_acc:.3f}")

    os.makedirs(args.output, exist_ok=True)
    classes_path = os.path.join(args.output, "classes.json")
    with open(classes_path, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)

    fp32_path = os.path.join(args.output, "mobilenetv4_scrap_fp32.onnx")
    int8_path = os.path.join(args.output, "mobilenetv4_scrap_int8.onnx")
    export_onnx(model, fp32_path, args.img_size, device)
    quantize_int8(fp32_path, int8_path, calib_loader)

    print(f"Saved {classes_path}")
    print(f"Saved {int8_path}")
    print("Place both files under frontend/public/models/ and run: npm run fetch-models")


if __name__ == "__main__":
    main()
