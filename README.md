# repricer-monorepo

This is a monorepo using turborepo for the repricer app with 4 apps. It is hosted on the digital ocean app platform. You can see the DO configuration in the `.do` folder

1. `front-end` is the front-end just for the new (v2) algorithm using Vite + React
2. `repricer` is the old "repricer" web app, which also hosts the ejs front-end
3. `api-core` is the old `repricer-api-core` service
4. `db-migrations` are knex DB migrations to initialize the v2 algo tables. Make sure you run these first if you want to make a new environment