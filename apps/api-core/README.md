# repricer-api-core

## Dev
Run `npm run dev` to have auto-detecting changes on the dev server. There are debug configurations in `.vscode` folder to run this in debug mode. You need a `.env` file locally to load defaults. Acquire these from someone from the team. 

## Husky
If repository already exists for you, you'll need to run `npm run prepare` to set up husky. Otherwise, on fresh installs there should be no issue. 

## Env vars

- `IS_DEV` basically toggles if it will hit the net32 endpoints or not. Be very careful with this setting to not run prod on your local. 





