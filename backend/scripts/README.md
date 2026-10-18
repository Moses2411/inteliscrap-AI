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

When the sandbox is flaky (it has been returning HTTP 500 on `POST
/v1_0/apiuser`), retry in a loop and write straight into a Render env file once
it recovers:

```bash
python scripts/momo_provision.py --retry 5 --interval 120 \
  --write --env-file render.staging.env
```

Exit code is ``0`` on success and ``1`` while the sandbox is still down, so it
is safe to schedule (cron, Render Cron Job, or Windows Task Scheduler) to run
until the credentials are provisioned.

Environment:
- MOMO_SUBSCRIPTION_KEY (required)
- MOMO_BASE_URL (default https://sandbox.momodeveloper.mtn.com)
- MOMO_CALLBACK_HOST or MOMO_CALLBACK_BASE_URL (the host is extracted from the URL)

Outputs MOMO_ENABLED, MOMO_BASE_URL, MOMO_SUBSCRIPTION_KEY, MOMO_API_USER,
MOMO_API_KEY, MOMO_TARGET_ENVIRONMENT, MOMO_CURRENCY, MOMO_MSISDN_COUNTRY_CODE
(and MOMO_CALLBACK_BASE_URL when it is set).
