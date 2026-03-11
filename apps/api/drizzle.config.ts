import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/@logic/**/infrastructure/table/*.table.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
