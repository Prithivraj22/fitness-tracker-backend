# 🏃‍♂️ Fitness Tracker Web Application

A full-stack fitness tracking application that integrates with **Google Health API** to monitor health metrics from Fitbit, Pixel Watch, and Health Connect. The legacy Fitbit API remains available only while existing users migrate.

## 🚀 Features
- 🔐 **Authentication** with JWT
- 📊 Health data via **Google Health API**
- 🍽️ Daily calorie and macro tracking with server-calculated nutrition totals
- ✏️ Editable user profiles with conditional rendering
- 🌐 RESTful API for backend services
- 💾 MongoDB for persistent data storage

## 🖥️ Tech Stack

### Frontend (React)
- React.js with Hooks
- Axios for API calls
- Dynamic styling for user interactivity

### Backend (Node.js & Express)
- Express.js REST API
- MongoDB & Mongoose for data persistence
- Google OAuth 2.0 and transitional Fitbit OAuth support
- JWT-based Authentication

Users sign in with email. Display names are stored separately and can be shared
by multiple accounts. Legacy username login remains available for existing
accounts while profile data is migrated.

## 📦 Repositories
- **Frontend**: [FITNESS_TRACKER](https://github.com/Adhi2312/FITNESS_TRACKER)
- **Backend**: [fitness-tracker-backend](https://github.com/Prithivraj22/fitness-tracker-backend)

## 🛠️ Setup Instructions

Copy `.env.example` to `.env` and provide deployment-specific secrets and URLs.
Never commit `.env` or reuse credentials from another environment.

For production, set `NODE_ENV=production` and set `FRONTEND_URL` to the exact
HTTPS frontend origin. Multiple allowed origins can be comma-separated. The
deployment health check should request `GET /health`; it returns `200` only
after MongoDB is connected.

Use different random values for `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`,
`GOOGLE_HEALTH_OAUTH_STATE_SECRET`, and `PROVIDER_TOKEN_ENCRYPTION_KEY`. Generate at least
32 random bytes for each value. The older `SECRET_KEY` and `REFRESH_SECRET`
variables remain as compatibility fallbacks during migration and should also be
unique.

Create a Google OAuth web client and set `GOOGLE_HEALTH_CLIENT_ID`,
`GOOGLE_HEALTH_CLIENT_SECRET`, and `GOOGLE_HEALTH_REDIRECT_URI`. Register the
same redirect URI in the OAuth client. The application requests only the
read-only activity and fitness scope. Google currently limits onboarding for
new Google Health API projects, so production connection testing also requires
Google Health project access.

When Google's **Enable the API and get an OAuth 2.0 Client ID** dialog first
asks for an authorized redirect URI, its Google Health quick start instructs
you to enter `https://www.google.com`. After the client is created, open that
client in Google Cloud Credentials and add the public HTTPS callback used by
Nutrix: `https://<your-backend-domain>/auth/google-health/callback`. The value
must exactly match `GOOGLE_HEALTH_REDIRECT_URI`. This Google Health setup does
not accept the plain `http://localhost` callback shown in older local examples;
local end-to-end testing therefore needs an HTTPS development URL or tunnel.
Add your Google account under OAuth Audience > Test users and enable the
`googlehealth.activity_and_fitness.readonly` and
`googlehealth.health_metrics_and_measurements.readonly` scopes under Data Access. Keep the
client secret only in the backend `.env` file.

### Backend
```bash
git clone https://github.com/Prithivraj22/fitness-tracker-backend
cd fitness-tracker-backend
npm install
npm run migrate:profiles -- --dry-run
npm run migrate:profiles
npm run seed:foods -- --dry-run
npm run seed:foods
npm start
```

Before running the seed or server, copy `.env.example` to `.env` and set
`MONGO_URI`. The seed command creates or updates 12 starter foods and can be run
again safely; it matches records by dish name instead of inserting duplicates.
Each food includes an explicit serving description because its calories and
macros are calculated per serving. Use the dry-run command to validate the seed
file without connecting to or changing MongoDB.

The profile migration copies legacy usernames into the new display-name field.
New accounts use email for login while existing username logins remain accepted
during migration. Run the dry-run first to review how many users will change.

### Render deployment

The repository includes `render.yaml`, which creates the Node API and React
static site together. In Render, create a Blueprint from this backend repository
and enter `MONGO_URI` when prompted. Render generates the authentication and
provider-encryption secrets, connects the frontend and backend URLs, deploys the
API in Singapore, and configures `/health` as its readiness check.

Fitbit and Google Health credentials are intentionally omitted from the initial
Blueprint. Add their client credentials and deployed HTTPS callback URLs later
when those integrations are enabled.

### Frontend
```bash
git clone https://github.com/Adhi2312/FITNESS_TRACKER
cd FITNESS_TRACKER
npm install
npm start
```

Copy the frontend `.env.example` to `.env` before starting it. The default API
URL points to the backend on port 4000 while the frontend runs on port 3000.

## 🤝 Contributors
- [@Prithivraj22](https://github.com/Prithivraj22)
- [@Adhi2312](https://github.com/Adhi2312)

---
