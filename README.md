# SMM Panel

A full-stack Social Media Marketing (SMM) reselling platform. Users sign up, add funds via
Easypaisa (manual admin approval), browse services (Instagram/TikTok/YouTube/Facebook likes,
followers, views, etc.), and place orders. Orders are automatically synced with a third-party
SMM API provider every 60 seconds via a background cron job. Includes a full admin panel.

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** MongoDB (Mongoose) — works locally or with MongoDB Atlas
- **Auth:** JWT in httpOnly cookies, bcrypt password hashing
- **Frontend:** EJS + Bootstrap 5 (server-rendered)
- **Uploads:** Multer (payment screenshots)
- **Scheduling:** node-cron (order sync every 60s, provider balance sync every 30m)
- **Security:** helmet, express-rate-limit, cors, express-validator

## Folder Structure

```
smm-panel/
├── server.js              Entry point — starts Express + cron jobs
├── config/db.js           MongoDB connection
├── models/                Mongoose schemas (User, Service, Order, Transaction, ApiProvider, Settings)
├── middleware/             auth, adminAuth, upload (multer)
├── controllers/            Route handler logic
├── routes/                 Express routers
├── services/                providerApi.js (external SMM API client), orderSync.js (cron logic)
├── cron/index.js            Registers scheduled jobs
├── views/                   EJS templates (Bootstrap 5)
├── public/                  Static assets + uploaded screenshots
└── seed/createAdmin.js      Creates the first admin account
```

## 1. Install

```bash
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `PORT` | Port to run on (Railway sets this automatically) |
| `NODE_ENV` | `development` or `production` |
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `COOKIE_NAME` | Name of the auth cookie |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by the seed script to create your first admin |
| `APP_URL` | Public base URL of the app (shown in the API docs snippet on the profile page) |

## 3. Create the first admin account

```bash
npm run seed:admin
```

This reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` and creates (or promotes) an admin user.
Log in at `/login` with those credentials, then go to `/admin/dashboard`.

## 4. Run locally

```bash
npm start
```

The app runs at `http://localhost:3000` (or whatever `PORT` you set). MongoDB must be running
and reachable at `MONGO_URI`.

## 5. Connect your real SMM API provider

Once logged in as admin:

1. Go to **Admin → API Providers** and add your provider's name, API URL, and API key.
2. Click **Test Connection** to confirm it can reach the provider and fetch your balance.
3. Go to **Admin → Services** and click **Import Services** next to that provider to pull in
   its full service list (imported as *disabled* by default, with a 30% markup you can edit).
4. Review pricing, set your own margins, and flip services to **Active**.

The order-sync cron job (every 60 seconds) and provider-balance cron job (every 30 minutes)
start automatically with `server.js` — no manual trigger needed. Watch your terminal / Railway
logs for `[CRON]` lines to confirm they're running.

## 6. Deploy to Railway

1. Push this project to a GitHub repository.
2. In Railway, create a new project → **Deploy from GitHub repo**.
3. Add a MongoDB database (e.g. MongoDB Atlas free tier) and copy its connection string.
4. In Railway's **Variables** tab, set all the variables from `.env.example` (Railway provides
   `PORT` automatically — you don't need to set it yourself).
5. Railway will run `npm install` then `npm start` (from `package.json`'s `start` script).
6. Once deployed, run the admin seed script once via Railway's shell/console:
   `node seed/createAdmin.js`.

## Notes

- Payment screenshots are stored in `public/uploads/`. On Railway's ephemeral filesystem these
  will be lost on redeploy — for a production deployment, consider swapping the storage
  destination in `middleware/upload.js` for an object storage service (S3, Cloudinary, etc.).
- The public reseller API is available at `POST /api/v2` using the same `action`-based format
  as the upstream provider (`action=add|status|balance|services`), authenticated via each
  user's own `apiKey` (visible on their `/profile` page). This lets you resell from your own
  panel the same way you resell from your provider.
