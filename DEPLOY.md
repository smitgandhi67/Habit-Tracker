# Deploying

This app deploys as **two independent halves**. Pushing to `master` only ships
one of them. Forgetting the other is the failure mode this document exists to
prevent: the UI updates, the API does not, and the new UI silently renders
nothing because the fields it reads are missing from the response.

| Half | Where it runs | How it deploys |
| --- | --- | --- |
| Frontend (`src/`) | Vercel | **Automatic** on push to `master` |
| API (`server/`) | AWS Lambda + API Gateway, `us-east-2` | **Manual** — nothing is automated |

`vercel.json` rewrites `/api/*` to the API Gateway URL, so the browser sees one
origin and CORS never comes into play.

- Stack: `habit-tracker` (CloudFormation, via AWS SAM)
- Function: `habit-tracker-HabitTrackerFunction-StVdgOCMeIVW`
- API: `https://0yku70o00i.execute-api.us-east-2.amazonaws.com`

## Deploying the API

### Preferred: SAM

Requires the SAM CLI (`sam --version`). Use this whenever `template.yaml`
changes — new environment variables, IAM, routes, timeouts.

```bash
cd server
npm run deploy:update      # sam build && sam deploy
```

> `samconfig.toml` pins `AllowedOrigin="http://localhost:3002"`, which is what
> production is currently running. It is harmless today only because Vercel
> proxies `/api/*` server-side, so the browser never issues a cross-origin
> request. If the frontend is ever pointed straight at API Gateway, this must be
> changed to the real origin first or every request will fail CORS.

### Code-only, without the SAM CLI

Valid when **only JavaScript under `server/` changed** — no `template.yaml`
edits, no new environment variables. Preserves env vars, API Gateway and the
stack; it updates the function's code in place.

```bash
# 1. Stage the source exactly as CodeUri: . would
STAGE=$(mktemp -d)
tar -cf - --exclude=node_modules --exclude=.aws-sam -C server . | tar -xf - -C "$STAGE"

# 2. Production dependencies only
(cd "$STAGE" && npm ci --omit=dev)

# 3. Zip it — see the warning below
# 4. Upload
aws lambda update-function-code \
  --region us-east-2 \
  --function-name habit-tracker-HabitTrackerFunction-StVdgOCMeIVW \
  --zip-file fileb://lambda.zip
aws lambda wait function-updated \
  --region us-east-2 \
  --function-name habit-tracker-HabitTrackerFunction-StVdgOCMeIVW
```

**Zipping on Windows — two traps, both silent:**

1. `tar -a -cf out.zip` with **GNU tar** (what Git Bash ships) does *not* produce
   a ZIP. GNU tar has no ZIP writer; it writes a plain tar with a `.zip` name.
2. `[System.IO.Compression.ZipFile]::CreateFromDirectory` on **Windows
   PowerShell 5.1** stores entries with `\` separators, so the archive contains
   a file literally named `routes\gym.js`. Lambda unpacks that as one flat
   filename and every `require('./routes/gym')` fails at runtime.

Write the entries by hand with normalized names, or use a zip tool known to emit
`/`. Verify before uploading — no entry may contain a backslash:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$a = [System.IO.Compression.ZipFile]::OpenRead('lambda.zip')
@($a.Entries | Where-Object { $_.FullName.Contains([char]92) }).Count   # must be 0
```

A correct bundle is ~6 MB and ~2,360 entries.

## Verifying a deploy

`requireAuth` is mounted ahead of the gym router, so an unauthenticated request
to *any* `/api/gym/*` path returns 401 — including paths that do not exist. **401
does not prove a route shipped.** Check the artifact instead:

```bash
aws lambda get-function-configuration --region us-east-2 \
  --function-name habit-tracker-HabitTrackerFunction-StVdgOCMeIVW \
  --query '{LastModified:LastModified,CodeSize:CodeSize,LastUpdateStatus:LastUpdateStatus}'

# Definitive: download what is actually running and look inside
URL=$(aws lambda get-function --region us-east-2 \
  --function-name habit-tracker-HabitTrackerFunction-StVdgOCMeIVW \
  --query 'Code.Location' --output text)
curl -s -o deployed.zip "$URL"
```

`GET /api/health` is unauthenticated and reports database connectivity.

## Before deploying

```bash
npm --prefix server test    # 267 tests
npm run lint                # server must be clean
npm run build               # frontend must build
```
