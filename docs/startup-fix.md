# Startup repair and cloud deployment

## Fixed
- Server output now goes to dist/server; Vite writes only dist/web. Previously Vite could delete the compiled server.
- Production Express serves the built website and API on one port.
- Production opens the configured SQLite file rather than an in-memory database.
- Development and production load the optional .env file using Node 22.
- A Dockerfile supports running the application on a cloud container host.

## Run locally
Install Node 22 (22.9 or later within the 22 series). In the project folder:

```sh
npm install
npm run build
npm start
```

Open http://localhost:3000. For development use npm run dev and open the Vite address shown in the terminal. The development proxy expects API port 3000.

## Cloud
Deploy the Dockerfile to a container host with HTTPS. Set PORT to the port expected by the host and attach a persistent disk at /data. Both API and website run on the host, so your home computer may be switched off. Without a persistent disk, SQLite history can disappear on redeployment.

Supabase is an alternative database, not a host for this existing Express process. No Supabase connection is implemented yet. History is currently a shared recent-search list, not private per-user history; add user/session isolation before a public multi-user launch.

## Remaining limitations
The camera button is still a placeholder. Live Galmart access and source normalization require verification. No cloud deployment has been performed. Dependency installation, production build and runtime tests could not be completed in this environment because dependencies were unavailable in the local cache.
