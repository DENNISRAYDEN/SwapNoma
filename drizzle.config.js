export default {
  dialect: "postgresql",
  schema: "./utils/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    connectionString: process.env.DATABASE_URL,
  },
};
