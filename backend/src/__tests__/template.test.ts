import { renderHtml, generateDocument, jsonToDocx } from "../services/template";
import { inferMapping, applyMapping } from "../services/mapping";
import { signPayload, verifySignature } from "../services/webhooks";

describe("template engine", () => {
  it("renders scalar variables with HTML escaping", () => {
    expect(renderHtml("Hello {{name}}", { name: "World" })).toBe("Hello World");
    expect(renderHtml("Hi <b>{{name}}</b>", { name: "<script>" })).toBe("Hi <b>&lt;script&gt;</b>");
  });

  it("renders raw triple-mustache", () => {
    expect(renderHtml("Hi {{{name}}}", { name: "<b>bold</b>" })).toBe("Hi <b>bold</b>");
  });

  it("renders #each sections", () => {
    const tpl = "{{#each items}}{{this}}{{/each}}";
    expect(renderHtml(tpl, { items: ["a", "b", "c"] })).toBe("abc");
  });

  it("renders #each with item fields", () => {
    const tpl = "{{#each users}}{{name}};{{/each}}";
    expect(renderHtml(tpl, { users: [{ name: "Al" }, { name: "Bo" }] })).toBe("Al;Bo;");
  });

  it("renders #if sections", () => {
    expect(renderHtml("{{#if show}}yes{{/if}}", { show: true })).toBe("yes");
    expect(renderHtml("{{#if show}}yes{{/if}}", { show: false })).toBe("");
  });

  it("generateDocument html returns rendered html", async () => {
    const out = await generateDocument("<p>{{name}}</p>", { name: "A" }, "html");
    expect(out.toString("utf-8")).toBe("<p>A</p>");
  });

  it("generateDocument md returns stripped text", async () => {
    const out = await generateDocument("<p>Hello <b>World</b></p>", {}, "md");
    expect(out.toString("utf-8")).toContain("Hello World");
  });

  it("generateDocument pdf returns a PDF buffer", async () => {
    const out = await generateDocument("<p>Hello</p>", {}, "pdf");
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString("utf-8", 0, 5)).toBe("%PDF");
  });

  it("jsonToDocx returns a DOCX buffer (zip)", async () => {
    const out = await jsonToDocx({ title: "Invoice", items: [{ name: "x", qty: 1 }] });
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString("utf-8", 0, 2)).toBe("PK");
  });
});

describe("data mapping", () => {
  it("inferMapping maps variables to sample leaf paths", () => {
    const result = inferMapping(
      { customer_name: "Acme", line_items: [{ qty: 2 }] },
      ["customer_name", "total"],
    );
    expect(result.mappings.length).toBe(2);
    const cn = result.mappings.find((m) => m.target === "customer_name");
    expect(cn?.source).toBe("customer_name");
    expect(cn?.confidence).toBe(1);
  });

  it("applyMapping resolves source paths into targets", () => {
    const out = applyMapping(
      [{ source: "customer_name", target: "client" }, { source: "line_items", target: "items" }],
      { customer_name: "Acme", line_items: [1, 2] },
    );
    expect(out.client).toBe("Acme");
    expect(out.items).toEqual([1, 2]);
  });
});

describe("webhook signatures", () => {
  const secret = "whsec_test123";
  const payload = JSON.stringify({ event: "doc.generated", jobId: "job_1" });

  it("signs and verifies a payload", () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature(secret, payload, sig)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature(secret, payload + "x", sig)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = signPayload(secret, payload);
    expect(verifySignature("wrong", payload, sig)).toBe(false);
  });
});
