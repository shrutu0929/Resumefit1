import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

app.post("/api/analyze", upload.single("resume"), async (request, response) => {
  try {
    let resumeText = request.body.resumeText?.trim() || "";
    const jobDescription = request.body.jobDescription?.trim() || "";

    if (request.file) {
      const pdf = await pdfParse(request.file.buffer);
      resumeText = pdf.text.trim();
    }

    if (!resumeText || !jobDescription) {
      return response.status(400).json({
        error: "Add resume text or upload a PDF and enter a job description."
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return response.status(500).json({
        error: "Add your Anthropic API key as ANTHROPIC_API_KEY in the .env file."
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      fetch: globalThis.fetch
    });
    const models = await anthropic.models.list({
      limit: 1,
      lifecycle: ["active"]
    });
    const model = models.data[0]?.id;

    if (!model) {
      return response.status(502).json({
        error: "No active Anthropic model is available for this account."
      });
    }

    const anthropicMessage = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system:
        "You compare resumes with job descriptions. Return only valid JSON with this exact shape: " +
        '{"matchScore": number, "missingKeywords": string[], "summary": string}. ' +
        "Use a matchScore from 0 to 100 and keep missingKeywords to 12 items.",
      messages: [
        {
          role: "user",
          content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
        }
      ]
    });

    let result;

    try {
      const content = anthropicMessage.content.find((block) => block.type === "text")?.text;
      result = JSON.parse(content);
    } catch {
      return response.status(502).json({
        error: "The AI returned an invalid response."
      });
    }

    return response.json({
      matchScore: Math.max(0, Math.min(100, Number(result.matchScore) || 0)),
      missingKeywords: Array.isArray(result.missingKeywords)
        ? result.missingKeywords.slice(0, 12)
        : [],
      summary: typeof result.summary === "string" ? result.summary : ""
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return response.status(502).json({
        error: "Anthropic rejected the API key. Create an API key in the Anthropic Console and update ANTHROPIC_API_KEY in .env."
      });
    }

    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API request failed:", error.status, error.message);
      return response.status(502).json({
        error: "The Anthropic API request failed. Check the API key, account, and model access."
      });
    }

    console.error(error);
    return response.status(500).json({
      error: "Could not read or analyze the resume."
    });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 5000;
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`ResumeFit server running at http://localhost:${port}`);
  });
}

export default app;
