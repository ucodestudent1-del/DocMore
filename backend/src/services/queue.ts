import { Queue } from "bullmq";
import { config } from "../config";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}

export const conversionQueue = new Queue("document-conversion", {
  connection: parseRedisUrl(config.REDIS_URL || "redis://localhost:6379"),
});

export default conversionQueue;
