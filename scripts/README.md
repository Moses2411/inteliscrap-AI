# Provisioning scripts

## MTN MoMo sandbox provisioning

These scripts create an API user + API key from your Collections subscription key (sandbox).

### Prerequisites
- MOMO_SUBSCRIPTION_KEY (primary key for Collections product)
- Python 3.11+ and httpx + python-dotenv (for Python script)
- curl (for bash script)
- PowerShell (for ps1 script)

### Option 1: Python (recommended)
```bash
cd backend
pip install httpx python-dotenv
python scripts/momo_provision.py --write   # prints the env vars and updates backend/.env
```
The script lives in backend/scripts/ and loads existing values from backend/.env.

### Option 2: Bash (Linux/macOS/WSL)
```bash
MOMO_SUBSCRIPTION_KEY=your_key bash scripts/momo-provision.sh
```

### Option 3: PowerShell (Windows)
```powershell
$env:MOMO_SUBSCRIPTION_KEY="your_key"
.\scripts\momo-provision.ps1
```

All scripts print:
- MOMO_API_USER
- MOMO_API_KEY

Set these (and MOMO_ENABLED=true) in .env/Render env vars. Restart the backend.
