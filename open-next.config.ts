import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Configuración de OpenNext para Cloudflare Workers.
// La base de datos vive en el worker separado "alqemia-db"
// (Durable Object SQLite) y se accede mediante el binding HUB_DB.
export default defineCloudflareConfig({})
