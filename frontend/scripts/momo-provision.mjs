#!/usr/bin/env node
// Simple MoMo sandbox provisioner via Node.js (fetch)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const candidates = [
    join(__dirname, '../../backend/.env'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '../backend/.env'),
  ];
  for (const c of candidates) {
    try {
      const txt = readFileSync(c, 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        const k = m[1];
        const v = m[2].trim().replace(/^["']|["']$/g, '');
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch {}
  }
}

function get(k, def='') {
  return process.env[k] || def;
}

async function main() {
  loadEnv();
  const subKey = get('MOMO_SUBSCRIPTION_KEY');
  if (!subKey) {
    console.error('MOMO_SUBSCRIPTION_KEY is required');
    process.exit(2);
  }
  const baseUrl = get('MOMO_BASE_URL', 'https://sandbox.momodeveloper.mtn.com').replace(/\/$/, '');
  let cb = get('MOMO_CALLBACK_HOST');
  if (!cb) {
    const cbb = get('MOMO_CALLBACK_BASE_URL');
    if (cbb) {
      try { cb = new URL(cbb).hostname; } catch { cb = cbb; }
    }
  }
  if (!cb) cb = 'inteliscrap.example.com';

  const apiUser = crypto.randomUUID();
  const headersKey = { 'Ocp-Apim-Subscription-Key': subKey };

  // create user
  let r = await fetch(`${baseUrl}/v1_0/apiuser`, {
    method: 'POST',
    headers: { ...headersKey, 'X-Reference-Id': apiUser, 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerCallbackHost: cb }),
  });
  if (r.status !== 201) {
    const t = await r.text().catch(()=> '');
    console.error(`POST /v1_0/apiuser failed (${r.status}): ${t}`);
    process.exit(1);
  }
  // create key
  r = await fetch(`${baseUrl}/v1_0/apiuser/${apiUser}/apikey`, {
    method: 'POST',
    headers: headersKey,
  });
  if (r.status !== 200 && r.status !== 201) {
    const t = await r.text().catch(()=> '');
    console.error(`POST /v1_0/apiuser/${apiUser}/apikey failed (${r.status}): ${t}`);
    process.exit(1);
  }
  const d = await r.json().catch(()=> ({}));
  const apiKey = d.apiKey;
  if (!apiKey) {
    console.error('MoMo did not return apiKey');
    process.exit(1);
  }
  console.log('=== MTN MoMo Sandbox Provisioning ===');
  console.log(`MOMO_BASE_URL=${baseUrl}`);
  console.log(`MOMO_API_USER=${apiUser}`);
  console.log(`MOMO_API_KEY=${apiKey}`);
  console.log('=== Copy these into .env / Render env vars ===');
  console.log(`Also set: MOMO_ENABLED=true, MOMO_SUBSCRIPTION_KEY=${subKey}, MOMO_TARGET_ENVIRONMENT=sandbox, MOMO_CURRENCY=EUR`);
}

main().catch(e => { console.error(e); process.exit(1); });
