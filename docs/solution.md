Here’s a complete, paste-ready explanation/solution in English.

---

## Root Cause

You are **not talking to the Antigravity language server API correctly**.

Antigravity’s local service is **not a REST API** with endpoints like:

- `/api/v1/user/status`
- `/v1/user/status`
- `/quota`
- `/status`

Those paths will always fail (often with **403 Invalid CSRF token**) because the language server expects **Connect RPC-style endpoints** and a **specific CSRF header name**.

Additionally, the CSRF header you are sending is wrong. The server does **not** use `X-CSRF-Token` / `csrf-token`. It expects:

- **`X-Codeium-Csrf-Token: <token>`**
- and also **`Connect-Protocol-Version: 1`**

This is exactly how the working project `wusimpl/AntigravityQuotaWatcher` does it.

---

## What the working project does (AntigravityQuotaWatcher)

### 1) Extract token/ports from process args
It reads the running `language_server_*` process command line and extracts:

- `--csrf_token <uuid>`
- `--extension_server_port <port>` (HTTP fallback port)

### 2) Find the correct “connect port” (HTTPS)
The language server usually listens on multiple ports. The extension:

- Lists all listening ports for the PID (netstat/lsof/ss)
- Probes each port with:

`POST https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUnleashData`

Headers used in probe:
- `Content-Type: application/json`
- **`X-Codeium-Csrf-Token: <csrf>`**
- **`Connect-Protocol-Version: 1`**

Body:
```json
{ "wrapper_data": {} }
```

If it gets HTTP 200 and valid JSON, that port is considered the correct **connectPort**.

### 3) Fetch quota via GetUserStatus (NOT /user/status)
To fetch quota it calls:

`POST https://127.0.0.1:<connectPort>/exa.language_server_pb.LanguageServerService/GetUserStatus`

Headers:
- `Content-Type: application/json`
- **`X-Codeium-Csrf-Token: <csrf>`**
- **`Connect-Protocol-Version: 1`**

Body (minimal):
```json
{
  "metadata": {
    "ideName": "antigravity",
    "extensionName": "antigravity",
    "locale": "en"
  }
}
```

### 4) HTTP fallback
If HTTPS fails with protocol errors (like `wrong_version_number` / `EPROTO`), it retries using HTTP on the `extension_server_port`:

`POST http://127.0.0.1:<extensionPort>/exa.language_server_pb.LanguageServerService/GetUserStatus`

Same headers.

---

## Exact Fix You Need

### A) Stop calling REST endpoints
Remove all attempts like:

- `/api/v1/user/status`
- `/v1/user/status`
- `/status`
- `/quota`

They are not valid for this service.

### B) Use the correct CSRF header name
Replace your CSRF header logic:

**WRONG**
```ts
headers['X-CSRF-Token'] = token
headers['csrf-token'] = token
```

**RIGHT**
```ts
headers['X-Codeium-Csrf-Token'] = csrfToken;
headers['Connect-Protocol-Version'] = '1';
```

### C) Use the correct endpoint path
Call:

- `/exa.language_server_pb.LanguageServerService/GetUserStatus`

### D) Use correct port strategy
- Prefer probing listening ports to find the correct **connectPort** (HTTPS)
- Fallback to `extension_server_port` (HTTP) only if needed

---

## Minimal working request example (Node/TS)

```ts
const url = `https://127.0.0.1:${connectPort}/exa.language_server_pb.LanguageServerService/GetUserStatus`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Connect-Protocol-Version': '1',
    'X-Codeium-Csrf-Token': csrfToken,
  },
  body: JSON.stringify({
    metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' }
  }),
});
```

If HTTPS fails with protocol/cert issues, retry:

```ts
const url = `http://127.0.0.1:${extensionPort}/exa.language_server_pb.LanguageServerService/GetUserStatus`;
// same headers/body
```

(Also note: for HTTPS localhost you may need to allow self-signed certs via a custom agent/dispatcher, like the extensions do with `rejectUnauthorized: false`.)

---

## Why you were seeing “Invalid CSRF token”
Because the server never saw the token in the expected header (`X-Codeium-Csrf-Token`) and/or you were calling the wrong endpoints/port. It treats it as missing/invalid → 403.

---

If you want, paste your current full request URL + final headers + response body of the 403 and I can pinpoint whether your remaining issue is:
- wrong port (connectPort vs extensionPort),
- missing `Connect-Protocol-Version`,
- TLS/self-signed handling, or
- wrong endpoint path.