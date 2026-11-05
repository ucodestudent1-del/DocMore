import { createApp } from "./app";
import { config } from "./config";
import { migrate } from "./db/migrate";

async function bootstrap() {
  await migrate();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.log(`EveryDoc backend listening on port ${config.PORT} (${config.NODE_ENV})`);
  });

  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const sig of signals) {
    process.on(sig as any, () => {
      console.log(`Received ${sig}, shutting down...`);
      server.close(() => process.exit(0));
    });
  }
}

bootstrap().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});
