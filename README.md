# repricer-monorepo

This is a monorepo using turborepo for the repricer app with 4 apps. It is hosted on the digital ocean app platform. 

1. `front-end` is the front-end just for the new (v2) algorithm using Vite + React
2. `repricer` is the old "repricer" web app, which also hosts the ejs front-end. You need a `.env` file to set database credentials when developing locally.
3. `api-core` is the old `repricer-api-core` service. You need a `.env` file to set database credentials when developing locally.
4. `db-migrations` are knex DB migrations to initialize the v2 algo tables. Make sure you run these first if you want to make a new environment

In the packages folder, we have a shared package used to share code between the apps. Please use this if you want to share code between the apps. 

## Deployment

If this is a new environment, you need to run the seed and migrations in `db-migrations` package. See the README. (other instructions for the old v1 algo here...)

We currently have two apps, one for prod and one for dev. You can see their configurations in the `.do` folder. You are required to set the following environment variables in the settings page in DO for the app. These are also coincidentally the required settings in the .env file. If you do not set these, the program will not start. 

### Shared
- `MANAGED_MONGO_URL`
- `SQL_HOSTNAME`
- `SQL_USERNAME`
- `SQL_PASSWORD`
- `SQL_PORT`
- `SQL_DATABASE`

### `web` only
- `SESSION_SECRET`
- `SMTP_PWD`
- `REPRICER_API_BASE_URL`

### `internal-service` only
- `SCHEDULE_CRONS_ON_STARTUP`
- `RUN_SHIPPING_THRESHOLD_SCRAPE_ON_STARTUP`