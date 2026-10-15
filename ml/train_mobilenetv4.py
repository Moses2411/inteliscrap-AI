"""DEPRECATED — this standalone helper has been replaced by ``training/train.py``.

It lived under ``ml/`` and derived the class order from ``ImageFolder``'s
alphabetical folder order instead of ``frontend/public/models/classes.json``.
Those two orders differ, so a model trained here could silently map every
prediction to the wrong material.

The consolidated pipeline enforces the ``classes.json`` contract, measures real
accuracy, and writes the model manifest. Run that instead:

    pip install -r training/requirements.txt
    python training/dataset_check.py --data training/data
    python training/train.py --data training/data \
        --out frontend/public/models/mobilenetv4_scrap.onnx
    python training/evaluate.py --data training/data/test
"""

import sys

print(__doc__, file=sys.stderr)
sys.exit(2)
