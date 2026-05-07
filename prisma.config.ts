import "dotenv/config"

import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.NODE_ENV === "development" ? env("DEV_DB_URL") : env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
})