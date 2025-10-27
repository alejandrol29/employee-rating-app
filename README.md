# Employee Rating API

Express + Prisma service for collecting employee ratings, managing branches, and handling secure login for administrators. The application stores data in SQLite and exposes JSON endpoints plus a static client front end.

## Features
- JWT-authenticated endpoints for managing employees, branches, and ratings.
- File uploads for employee photos stored on a persistent volume.
- Prisma ORM with migrations and generated client.
- Seed and maintenance scripts to bootstrap and update data.

## Project Structure
```
├── index.js            # Express application entry point
├── prisma/             # Prisma schema, migrations, and local database
├── public/             # Static assets and uploaded images
├── seed.js             # Optional data seeding script
├── authMiddleware.js   # JWT verification helper
└── updatePhotos.js     # Utility script for photo maintenance
```

## Prerequisites
- Docker 20+ and Docker Compose v2 (or compatible `docker compose` CLI).
- Optional: Node.js 20+ and npm for running the app outside containers.

## Configuration
Copy the sample environment file and fill in the secrets appropriate for your environment.

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8081` | Internal port exposed by the container. |
| `JWT_SECRET` | `change-me` | Secret used to sign JWT tokens—replace in production. |
| `DATABASE_URL` | `file:/app/data/prod.db` | SQLite database path inside the container. |
| `HOST_IMAGES_DIR` | `./public/images` | Host directory mounted at `/app/public/images` when using Docker Compose. |

:warning: When running locally without Docker, point `DATABASE_URL` to a writable location on your machine (for example `file:./prisma/dev.db`).

## Running with Docker Compose
The repository ships with a production-oriented Compose configuration that handles build, Prisma migrations, and persistence for both the SQLite database and uploaded images.

```bash
# Build the image
docker compose build

# Start the service in the background
docker compose up -d

# Tail the logs (optional)
docker compose logs -f
```

The service listens on `http://localhost:8081` by default. Adjust the published port in `docker-compose.yml` if you need a different host port.

When adding or replacing employee photos, drop the files into the directory specified by `HOST_IMAGES_DIR`; Docker mounts that path into the container, so changes appear immediately without rebuilding the image. On the first start the entrypoint copies any seed images bundled with the app into that folder if it is empty.

### Data Persistence
- `prisma-data` (named volume) stores the SQLite database at `/app/data/prod.db`.
- The directory specified by `HOST_IMAGES_DIR` (default `./public/images`) is bind-mounted to `/app/public/images` to serve and persist uploaded files.

These named volumes keep state intact across container restarts or image rebuilds.

### Database Migrations
The container runs `npx prisma migrate deploy` on startup so schema changes are applied automatically. If you add new migrations, rebuild the image and restart the service to deploy them.

### Seeding Data
You can seed or manipulate data through the shipped scripts. Example:

```bash
docker compose exec employee-rating-api node seed.js
```

Ensure the service is running before executing the seed script.

## Reverse Proxy and HTTPS
Only one service can bind directly to host port `443`. Run this application on its internal port (default `8081`) and configure your existing reverse proxy (e.g., Nginx, Traefik, Caddy) to terminate TLS on `443` and route traffic to the container based on hostname or path.

For production deployments, point `HOST_IMAGES_DIR` to a dedicated directory on the host (for example `/srv/employee-rating/images`) and ensure it exists before starting the stack.

## Local Development (Optional)
If you prefer running the app without Docker:

```bash
npm install
npx prisma generate
npm run dev
```

Set `DATABASE_URL=file:./prisma/dev.db` and create the database with `npx prisma migrate dev` beforehand. Uploaded images will land in `public/images` relative to the project root.

## Health Check
Docker Compose defines a TCP health check against `PORT`. Adjust or extend it to suit your monitoring stack if needed.

## Maintenance
- Rotate `JWT_SECRET` periodically and update running containers.
- Back up the `prisma-data` and `employee-images` volumes if the data is critical.
- Review logs with `docker compose logs` to monitor authentication failures or upload issues.
