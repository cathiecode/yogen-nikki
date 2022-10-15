export default {
  mongodb: {
    url: process.env["MONGO_URL"] ?? "mongodb://127.0.0.1:27017",
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  moduleSystem: "esm",
  useFileHash: false,
};
