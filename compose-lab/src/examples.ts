/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Invented stacks with invented values, for trying the tool. They describe no real infrastructure. */
export const EXAMPLES = [
  {
    id: "tidy",
    yaml: `services:
  proxy:
    image: traefik:v3.1
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    healthcheck:
      test: ["CMD", "traefik", "healthcheck", "--ping"]
    depends_on:
      web:
        condition: service_healthy
    mem_limit: 256m
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    networks: [edge]

  web:
    image: example/web:2.4.1
    restart: unless-stopped
    user: "1000:1000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    environment:
      DATABASE_PASSWORD: \${DATABASE_PASSWORD}
    mem_limit: 512m
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    networks: [edge, internal]

  worker:
    image: example/web:2.4.1
    command: ["node", "worker.js"]
    restart: unless-stopped
    user: "1000:1000"
    depends_on:
      db:
        condition: service_healthy
    mem_limit: 512m
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    networks: [internal]

  db:
    image: postgres:16.4
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
    volumes:
      - dbdata:/var/lib/postgresql/data
    mem_limit: 1g
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    networks: [internal]

  cache:
    image: redis:7.4
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
    mem_limit: 256m
    logging: { driver: local }
    security_opt: ["no-new-privileges:true"]
    networks: [internal]

networks:
  edge: {}
  internal: {}

volumes:
  dbdata: {}
`,
  },
  {
    id: "messy",
    yaml: `version: "3.8"

services:
  web:
    image: example/web:latest
    container_name: web
    ports:
      - "80:3000"
    environment:
      - SESSION_SECRET=example-not-a-real-secret
      - API_KEY=example-not-a-real-key
    depends_on:
      - db
      - search

  db:
    image: postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: example-not-a-real-password
    volumes:
      - ./data:/var/lib/postgresql/data

  search:
    image: opensearchproject/opensearch:2
    ports:
      - "9200:9200"
    privileged: true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9200"]

  agent:
    image: example/agent:1.0
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - ghost

  cron:
    image: example/cron:1.0
    ports:
      - "80:8080"

networks:
  spare: {}

volumes:
  old-data: {}
`,
  },
] as const;
