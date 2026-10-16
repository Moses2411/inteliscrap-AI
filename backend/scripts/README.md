# Backend scripts

## momo_provision.py
Creates sandbox API user + API key from MOMO_SUBSCRIPTION_KEY, then prints the
full MOMO_* env block to copy into backend/.env or your Render env vars.

```bash
cd backend
pip install httpx python-dotenv
python scripts/momo_provision.py            # print the env vars
python scripts/momo_provision.py --write    # also upsert them into backend/.env
```
Environment:
- MOMO_SUBSCRIPTION_KEY (required)
- MOMO_BASE_URL (default https://sandbox.momodeveloper.mtn.com)
- MOMO_CALLBACK_HOST or MOMO_CALLBACK_BASE_URL (the host is extracted from the URL)

Outputs MOMO_ENABLED, MOMO_BASE_URL, MOMO_SUBSCRIPTION_KEY, MOMO_API_USER,
MOMO_API_KEY, MOMO_TARGET_ENVIRONMENT, MOMO_CURRENCY, MOMO_MSISDN_COUNTRY_CODE
(and MOMO_CALLBACK_BASE_URL when it is set).
