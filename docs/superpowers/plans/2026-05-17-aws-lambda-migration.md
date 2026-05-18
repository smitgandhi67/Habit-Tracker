# AWS Lambda Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the HabitTracker Express backend to AWS Lambda + API Gateway HTTP API so hosting costs ~$0.18/month at 1,500 req/day.

**Architecture:** Wrap existing Express app with `@vendia/serverless-express` so zero route rewrites are needed. Extract `app.js` (Express setup) from `index.js` (local server listen) so the same app object is reused by both local dev and Lambda handler. Rate limiting removed (stateless Lambda instances can't share counters; API Gateway throttling covers it). Cookie auth updated to `sameSite: 'none', secure: true` because frontend (Vercel) and API (API Gateway) are different domains. Frontend fetch calls gain a `VITE_API_BASE_URL` prefix so they hit the Lambda URL in production while Vite proxy still handles dev.

**Tech Stack:** Node.js 20.x, Express 5, @vendia/serverless-express, AWS SAM CLI, API Gateway HTTP API, MongoDB Atlas (unchanged)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/app.js` | Express app setup — no `listen` call |
| Modify | `server/index.js` | Local dev only — imports app.js, calls `listen` |
| Modify | `server/routes/auth.js` | Cookie sameSite fix |
| Create | `server/lambda.js` | Lambda handler entry point |
| Create | `server/template.yaml` | SAM infrastructure (Lambda + API Gateway) |
| Create | `server/samconfig.toml` | SAM deploy defaults |
| Modify | `server/package.json` | Add @vendia/serverless-express + deploy scripts |
| Create | `src/lib/api.js` | Shared apiFetch with VITE_API_BASE_URL prefix |
| Modify | `src/hooks/useHabits.js` | Use src/lib/api.js |
| Modify | `src/hooks/useGym.js` | Use src/lib/api.js |
| Modify | `src/context/AuthContext.jsx` | Use VITE_API_BASE_URL for auth fetches |
| Create | `.env.example` | Frontend env template |
| Create | `server/.env.lambda.example` | Lambda env var template |

---

## Phase 1 — Separate app.js from index.js

### Task 1: Create server/app.js

**Files:**
- Create: `server/app.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/app.js**

Extract all Express setup from `server/index.js` into `server/app.js`. Remove the `mongoose.connect` call and `app.listen` — those stay in `index.js`. Remove `express-rate-limit` entirely (Lambda instances are stateless; API Gateway default throttle of 10k req/s is more than sufficient for 1,500 req/day).

```js
// server/app.js
require('dotenv').config();

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ALLOWED_ORIGIN'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

const requireAuth  = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRouter   = require('./routes/auth');
const habitsRouter = require('./routes/habits');
const logsRouter   = require('./routes/logs');
const gymRouter    = require('./routes/gym');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/habits', requireAuth, habitsRouter);
app.use('/api/logs',   requireAuth, logsRouter);
app.use('/api/gym',    requireAuth, gymRouter);

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 2: Rewrite server/index.js to use app.js**

`index.js` becomes purely the local dev server entry point.

```js
// server/index.js
const mongoose = require('mongoose');
const app      = require('./app');

const PORT = process.env.PORT || 3003;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    const shutdown = () => {
      server.close(() => {
        mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
```

- [ ] **Step 3: Start the server locally and verify it still works**

```bash
cd server && node index.js
```

Expected output:
```
Connected to MongoDB
Server running on port 3003
```

Hit `http://localhost:3003/api/health` — should return `{"status":"ok"}`.

---

## Phase 2 — Fix Cookie Settings for Cross-Origin

### Task 2: Update auth.js cookie options

When frontend (Vercel) and API (API Gateway) are on different domains, cookies require `sameSite: 'none'` and `secure: true`. An env var `COOKIE_SAME_SITE` controls this so local dev keeps `lax`.

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Update COOKIE_OPTS in server/routes/auth.js**

Replace lines 10–15 in `server/routes/auth.js`:

```js
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.COOKIE_SAME_SITE === 'none' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

- [ ] **Step 2: Verify local dev auth still works**

Restart the server and test Google login at `http://localhost:3002`. Cookie should still be set (sameSite: lax in dev since `COOKIE_SAME_SITE` is not set locally).

---

## Phase 3 — Lambda Handler + MongoDB Connection Caching

### Task 3: Install @vendia/serverless-express and create lambda.js

Lambda reuses the same process across warm invocations. Cache the Mongoose connection outside the handler so it's reused instead of reconnecting on every request.

**Files:**
- Modify: `server/package.json`
- Create: `server/lambda.js`

- [ ] **Step 1: Install @vendia/serverless-express**

```bash
cd server && npm install @vendia/serverless-express
```

Expected: `@vendia/serverless-express` appears in `package.json` dependencies.

- [ ] **Step 2: Create server/lambda.js**

```js
// server/lambda.js
const serverlessExpress = require('@vendia/serverless-express');
const mongoose          = require('mongoose');
const app               = require('./app');

let cachedHandler = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}

exports.handler = async (event, context) => {
  // Tell Lambda not to wait for the event loop to be empty before returning
  context.callbackWaitsForEmptyEventLoop = false;

  await connectDB();

  if (!cachedHandler) {
    cachedHandler = serverlessExpress({ app });
  }

  return cachedHandler(event, context);
};
```

- [ ] **Step 3: Verify lambda.js loads without error**

```bash
cd server && node -e "require('./lambda'); console.log('lambda.js OK')"
```

Expected: `lambda.js OK` (no crash). MongoDB won't connect since we're not calling `exports.handler`, that's fine.

---

## Phase 4 — SAM Infrastructure

### Task 4: Create SAM template and config

**Files:**
- Create: `server/template.yaml`
- Create: `server/samconfig.toml`
- Create: `server/.env.lambda.example`
- Modify: `server/package.json`

- [ ] **Step 1: Create server/template.yaml**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Description: HabitTracker API

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 15
    MemorySize: 256
    Environment:
      Variables:
        NODE_ENV: production
        MONGODB_URI: !Ref MongoDbUri
        JWT_SECRET: !Ref JwtSecret
        GOOGLE_CLIENT_ID: !Ref GoogleClientId
        ALLOWED_ORIGIN: !Ref AllowedOrigin
        COOKIE_SAME_SITE: none

Parameters:
  MongoDbUri:
    Type: String
    NoEcho: true
  JwtSecret:
    Type: String
    NoEcho: true
  GoogleClientId:
    Type: String
  AllowedOrigin:
    Type: String

Resources:
  HabitTrackerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.handler
      CodeUri: .
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HabitTrackerApi

  HabitTrackerApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - !Ref AllowedOrigin
        AllowHeaders:
          - Content-Type
          - Cookie
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowCredentials: true
        MaxAge: 300

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${HabitTrackerApi}.execute-api.${AWS::Region}.amazonaws.com'
```

- [ ] **Step 2: Create server/samconfig.toml**

```toml
version = 0.1

[default.global.parameters]
stack_name = "habit-tracker"

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true
region = "us-east-1"
```

- [ ] **Step 3: Create server/.env.lambda.example**

```
# Copy this and fill in values when deploying via sam deploy
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/habittracker
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
ALLOWED_ORIGIN=https://your-app.vercel.app
COOKIE_SAME_SITE=none
```

- [ ] **Step 4: Add deploy scripts to server/package.json**

Add to the `scripts` section in `server/package.json`:

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js",
  "build": "sam build",
  "deploy": "sam deploy --guided",
  "deploy:update": "sam build && sam deploy"
}
```

---

## Phase 5 — Frontend API URL Abstraction

### Task 5: Create shared API utility

Frontend currently uses relative paths (`/api/...`). In production, Lambda is on a different domain. Create a shared `apiFetch` that prepends `VITE_API_BASE_URL` when set (empty string in dev so Vite proxy still works).

**Files:**
- Create: `src/lib/api.js`
- Modify: `src/hooks/useHabits.js`
- Modify: `src/hooks/useGym.js`
- Modify: `src/context/AuthContext.jsx`
- Create: `.env.example`

- [ ] **Step 1: Create src/lib/api.js**

```js
// src/lib/api.js
const BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Update src/hooks/useHabits.js to import apiFetch**

Remove the local `apiFetch` function definition (lines 10–18) and add the import at the top:

```js
import { apiFetch } from '../lib/api';
```

The rest of the file is unchanged.

- [ ] **Step 3: Update src/hooks/useGym.js to import apiFetch**

Remove the local `apiFetch` function definition (lines 5–13) and add the import at the top:

```js
import { apiFetch } from '../lib/api';
```

The rest of the file is unchanged.

- [ ] **Step 4: Update src/context/AuthContext.jsx to use BASE URL**

Replace the three raw `fetch('/api/...')` calls with calls that use the base URL:

```js
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (googleCredential) => {
    const res = await fetch(`${BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: googleCredential }),
    });
    if (!res.ok) throw new Error('Login failed');
    const u = await res.json();
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 5: Create .env.example in root**

```
# Leave empty in dev (Vite proxy handles /api routing to localhost:3003)
# Set to Lambda URL in production:
# VITE_API_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

- [ ] **Step 6: Verify local dev still works**

```bash
# Terminal 1 — backend
cd server && node index.js

# Terminal 2 — frontend
npm run dev
```

Open `http://localhost:3002`. Login, create a habit, log it. All API calls should work via Vite proxy (no `VITE_API_BASE_URL` set = empty prefix = relative paths = proxy works).

---

## Phase 6 — AWS Deployment

### Task 6: Deploy to AWS

**Prerequisites (manual steps — not code):**
- AWS CLI installed and configured (`aws configure`) with an IAM user that has Lambda, API Gateway, CloudFormation, S3, and IAM permissions
- AWS SAM CLI installed (`winget install Amazon.SAM-CLI` or `choco install aws-sam-cli`)

- [ ] **Step 1: Install AWS CLI (if not installed)**

```powershell
winget install -e --id Amazon.AWSCLI
```

Verify: `aws --version`

- [ ] **Step 2: Install SAM CLI (if not installed)**

```powershell
winget install -e --id Amazon.SAM-CLI
```

Verify: `sam --version`

- [ ] **Step 3: Configure AWS credentials**

```bash
aws configure
```

Enter: AWS Access Key ID, AWS Secret Access Key, region (`us-east-1`), output format (`json`).

Get credentials from: AWS Console → IAM → Users → your user → Security credentials → Create access key.

- [ ] **Step 4: Build the Lambda package**

```bash
cd server && sam build
```

Expected: `.aws-sam/build/HabitTrackerFunction/` directory created with Node.js files and `node_modules`.

- [ ] **Step 5: Deploy (first time — guided)**

```bash
cd server && sam deploy --guided
```

When prompted:
- Stack name: `habit-tracker`
- Region: `us-east-1`
- Confirm changes: `y`
- Parameter `MongoDbUri`: paste your MongoDB connection string
- Parameter `JwtSecret`: paste your JWT secret
- Parameter `GoogleClientId`: paste your Google Client ID
- Parameter `AllowedOrigin`: your Vercel URL (e.g., `https://habit-tracker.vercel.app`) — use `http://localhost:3002` for now if not deployed yet
- Save arguments to config: `y`

Expected output ends with:
```
Outputs
Key   ApiUrl
Value https://abc123.execute-api.us-east-1.amazonaws.com
```

**Save that URL — it's your Lambda API endpoint.**

- [ ] **Step 6: Test the deployed Lambda**

```bash
curl https://abc123.execute-api.us-east-1.amazonaws.com/api/health
```

Expected: `{"status":"ok"}`

---

## Phase 7 — Frontend Production Config

### Task 7: Configure frontend for deployed Lambda

- [ ] **Step 1: Create .env.production in project root**

```
VITE_API_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com
VITE_GOOGLE_CLIENT_ID=288347590774-fkhioghvihmnbrh45vqi6dq39t42ga93.apps.googleusercontent.com
```

Replace `abc123.execute-api.us-east-1.amazonaws.com` with the actual URL from Step 6.

- [ ] **Step 2: Build frontend for production**

```bash
npm run build
```

Expected: `dist/` folder created. No build errors.

- [ ] **Step 3: Update ALLOWED_ORIGIN in Lambda if deploying frontend to Vercel**

Once you have the Vercel URL (e.g., `https://habit-tracker-xyz.vercel.app`):

```bash
cd server && sam deploy --parameter-overrides AllowedOrigin=https://habit-tracker-xyz.vercel.app
```

Or re-run `sam deploy` with the new origin.

- [ ] **Step 4: Add Vercel URL to Google OAuth authorized origins**

Go to: Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized JavaScript origins.

Add: `https://your-vercel-url.vercel.app`

- [ ] **Step 5: Deploy frontend to Vercel**

```bash
npx vercel --prod
```

Or connect the GitHub repo to Vercel dashboard and set env vars:
- `VITE_API_BASE_URL` = Lambda URL
- `VITE_GOOGLE_CLIENT_ID` = Google Client ID

- [ ] **Step 6: End-to-end test on production**

Open the Vercel URL → login with Google → create a habit → log it → view reports. Verify all features work.

---

## Self-Review

**Spec coverage:**
- ✅ Express app wrapped with serverless-express
- ✅ MongoDB connection cached across Lambda warm invocations
- ✅ Rate limiting removed (stateless Lambda; API Gateway throttle covers it)
- ✅ Cookie sameSite updated for cross-origin
- ✅ Frontend fetch calls use VITE_API_BASE_URL
- ✅ Local dev unchanged (Vite proxy, nodemon, relative API paths)
- ✅ SAM template defines Lambda + API Gateway + CORS
- ✅ Deployment instructions with expected outputs

**Cost at 1,500 req/day:**
- Lambda: $0 (45k/mo vs 1M free)
- API Gateway: $0.16/mo after 12-month free period
- MongoDB Atlas M0: $0
- Total: ~$0.18/month
