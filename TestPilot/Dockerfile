# TestPilot — production image. Builds the SPA and runs server/index.ts
# (`npm start`): built dist/ + every /api/* route, with server-side cookie
# auth ON (TP_AUTH defaults on in prod). Read HOSTING.md before exposing it.
# (Ported from the retired TestPilot-HostReady fork, 2026-10-30.)
#
# TestPilot imports ../packages/qa-core, so build from the REPO ROOT:
#   docker build -f TestPilot/Dockerfile -t testpilot .
# (TestPilot/Dockerfile.dockerignore keeps node_modules / .env / .auth out.)
FROM node:22-slim

WORKDIR /app/TestPilot
ENV NODE_ENV=production

# Install deps (devDeps included: build needs vite/tsc; runtime needs tsx).
COPY TestPilot/package*.json ./
RUN npm ci

# Shared QA core + app source, then build the static SPA into dist/.
COPY packages/qa-core /app/packages/qa-core
COPY TestPilot/ ./
RUN npm run build

# node:sqlite needs Node >= 22.5 + --experimental-sqlite (already in `npm start`).
# The shared TM database lives at $HOME/QA-Automations/testpilot-tm.db — mount a
# volume there so test cases survive container restarts.
ENV PORT=8080 HOST=0.0.0.0
VOLUME ["/root/QA-Automations"]
EXPOSE 8080

# Requests must carry an allowed Host: set TP_ALLOWED_HOSTS=<your-host>:<port>.
# The local-exec surface (runner/scheduler/pipeline) needs the framework repos +
# browsers on the host, so it only works where those exist (see docs/hosting/SAAS_PLAN.md).
CMD ["npm", "start"]
