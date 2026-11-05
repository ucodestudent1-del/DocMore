import { createApp } from "../app";
import { query } from "../db/pool";
import { generateRandomString } from "./helpers";
import request from "supertest";

const app = createApp();

describe("Documents API", () => {
  let authCookie: string;
  let testUserId: string;
  let workspaceId: string;

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
    await query(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

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
    authCookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0] || "";

    const wsCreate = await request(app)
      .post("/api/v1/documents")
      .set("Cookie", authCookie)
      .send({ title: "Init Doc", content: { blocks: [] } });
    workspaceId = wsCreate.body.workspace_id;
  });

  afterAll(async () => {
    if (testUserId) {
      await query("DELETE FROM users WHERE id = $1", [testUserId]);
    }
    await query("DROP TABLE IF EXISTS documents CASCADE");
    await query("DROP TABLE IF EXISTS workspaces CASCADE");
    await query("DROP TABLE IF EXISTS users CASCADE");
  });

  describe("POST /api/v1/documents", () => {
    it("creates a document", async () => {
      const res = await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "Test Doc", content: { blocks: [] } });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe("Test Doc");
    });

    it("rejects missing title", async () => {
      const res = await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "", content: { blocks: [] } });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/documents", () => {
    it("lists documents", async () => {
      await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "Doc 1", content: { blocks: [] } });

      const res = await request(app).get("/api/v1/documents").set("Cookie", authCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/v1/documents/:id", () => {
    it("gets a document by id", async () => {
      const createRes = await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "Get Doc", content: { blocks: [] } });

      const res = await request(app)
        .get(`/api/v1/documents/${createRes.body.id}`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
    });
  });

  describe("PUT /api/v1/documents/:id", () => {
    it("updates a document", async () => {
      const createRes = await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "Old Title", content: { blocks: [] } });

      const res = await request(app)
        .put(`/api/v1/documents/${createRes.body.id}`)
        .set("Cookie", authCookie)
        .send({ title: "New Title" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("New Title");
    });
  });

  describe("DELETE /api/v1/documents/:id", () => {
    it("deletes a document", async () => {
      const createRes = await request(app)
        .post("/api/v1/documents")
        .set("Cookie", authCookie)
        .send({ title: "To Delete", content: { blocks: [] } });

      const res = await request(app)
        .delete(`/api/v1/documents/${createRes.body.id}`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/v1/documents/${createRes.body.id}`)
        .set("Cookie", authCookie);
      expect(getRes.status).toBe(404);
    });
  });
});
