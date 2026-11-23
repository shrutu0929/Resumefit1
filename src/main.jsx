import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeResume(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!jobText.trim() || (!resumeText.trim() && !resumeFile)) {
      setError("Add your resume and paste the job description.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("jobDescription", jobText);
      formData.append("resumeText", resumeText);
      if (resumeFile) {
        formData.append("resume", resumeFile);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not analyze the resume.");
      }

      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">ResumeFit</p>
        <h1>AI Resume Analyzer</h1>
        <p>Compare your resume with a job description.</p>
      </header>

      <form className="analyzer" onSubmit={analyzeResume}>
        <div className="input-group">
          <label htmlFor="resumeFile">Upload PDF resume</label>
          <input
            id="resumeFile"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setResumeFile(event.target.files[0] || null)}
          />
        </div>

        <div className="input-group">
          <label htmlFor="resumeText">Resume text</label>
          <textarea
            id="resumeText"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            placeholder="Paste your resume text here..."
          />
        </div>

        <div className="input-group">
          <label htmlFor="jobText">Job description</label>
          <textarea
            id="jobText"
            value={jobText}
            onChange={(event) => setJobText(event.target.value)}
            placeholder="Paste the job description here..."
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Resume"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <section className="result" aria-live="polite">
          <div className="score-card">
            <span>Match Score</span>
            <strong>{result.matchScore}%</strong>
          </div>
          <div>
            <h2>Missing Keywords</h2>
            <p className="keywords">
              {result.missingKeywords.length
                ? result.missingKeywords.join(", ")
                : "None"}
            </p>
            {result.summary && (
              <>
                <h2>Summary</h2>
                <p>{result.summary}</p>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
