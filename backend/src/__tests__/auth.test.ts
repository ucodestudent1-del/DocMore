import { createApp } from "../app";
import { query } from "../db/pool";
import { generateRandomString } from "./helpers";
import request from "supertest";

const app = createApp();

describe("Auth API", () => {
  let testUserId: string;

  beforeAll(async () => {
    await query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  });

  afterAll(async () => {
    if (testUserId) {
      await query("DELETE FROM users WHERE id = $1", [testUserId]);
    }
    await query("DROP TABLE IF EXISTS users CASCADE");
    await query("DROP TABLE IF EXISTS workspaces CASCADE");
  });

  describe("POST /api/v1/auth/register", () => {
    it("registers a new user", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      const res = await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe(email);
      testUserId = res.body.id;
    });

    it("rejects duplicate email", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });

      const res = await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User 2",
      });

      expect(res.status).toBe(409);
    });

    it("rejects missing fields", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("logs in with valid credentials", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email,
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      testUserId = res.body.id;
    });

    it("rejects wrong password", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email,
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns 401 without session", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns user with valid session", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      const reg = await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });
      testUserId = reg.body.id;

      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email,
        password: "password123",
      });

      const cookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0];

      const res = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testUserId);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("logs out successfully", async () => {
      const email = `test-${generateRandomString(8)}@example.com`;
      await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        name: "Test User",
      });

      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email,
        password: "password123",
      });
      const cookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0];

      const res = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
      expect(res.status).toBe(200);

      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(meRes.status).toBe(401);
    });
  });
});
