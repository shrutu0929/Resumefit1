import { jest } from "@jest/globals";
import request from "supertest";
import app from "./server.js";

describe("ResumeFit API", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    global.fetch = originalFetch;
  });

  test("rejects a request without resume and job description", async () => {
    const response = await request(app)
      .post("/api/analyze")
      .field("resumeText", "")
      .field("jobDescription", "");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/resume/i);
  });

  test("reports a missing Anthropic API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await request(app)
      .post("/api/analyze")
      .field("resumeText", "React developer")
      .field("jobDescription", "React and JavaScript");

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/Anthropic API key/i);
  });

  test("explains when Anthropic rejects the API key", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = async () => new Response(
      JSON.stringify({
        type: "error",
        error: { type: "authentication_error", message: "invalid x-api-key" }
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    );

    const response = await request(app)
      .post("/api/analyze")
      .field("resumeText", "React developer")
      .field("jobDescription", "React and JavaScript");

    expect(response.status).toBe(502);
    expect(response.body.error).toMatch(/Anthropic rejected the API key/i);
  });

  test("returns normalized Anthropic analysis data", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = jest.fn(async (url) => {
      const payload = url.includes("/v1/models")
        ? {
            data: [{ id: "claude-test", type: "model" }],
            has_more: false
          }
        : {
            id: "msg-test",
            type: "message",
            role: "assistant",
            model: "claude-test",
            content: [{
              type: "text",
              text: JSON.stringify({
                matchScore: 145,
                missingKeywords: ["JavaScript", "React", "Testing"],
                summary: "A strong starting match."
              })
            }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 10 }
          };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const response = await request(app)
      .post("/api/analyze")
      .field("resumeText", "React developer")
      .field("jobDescription", "React and JavaScript");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      matchScore: 100,
      missingKeywords: ["JavaScript", "React", "Testing"],
      summary: "A strong starting match."
    });
    expect(global.fetch.mock.calls[0][0]).toContain("https://api.anthropic.com/v1/models");
    expect(global.fetch.mock.calls[1][0]).toContain("https://api.anthropic.com/v1/messages");
  });
});
