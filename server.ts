import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("lumina.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    target_id INTEGER,
    relationship TEXT,
    FOREIGN KEY(source_id) REFERENCES notes(id),
    FOREIGN KEY(target_id) REFERENCES notes(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Setup
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // API Routes
  app.get("/api/notes", (req, res) => {
    const notes = db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all();
    res.json(notes);
  });

  app.get("/api/connections", (req, res) => {
    const connections = db.prepare("SELECT * FROM connections").all();
    res.json(connections);
  });

  app.post("/api/connections", (req, res) => {
    const { source_id, target_id, relationship } = req.body;
    const info = db.prepare("INSERT INTO connections (source_id, target_id, relationship) VALUES (?, ?, ?)").run(source_id, target_id, relationship);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/notes", (req, res) => {
    const { title, content, tags } = req.body;
    const info = db.prepare("INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)").run(title, content, tags);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/notes/:id", (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    db.prepare("UPDATE notes SET title = ? WHERE id = ?").run(title, id);
    res.json({ success: true });
  });

  app.post("/api/analyze", async (req, res) => {
    const { content } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following note and extract key entities, themes, and potential connections to other topics. Return a JSON object with 'summary', 'entities', and 'themes'.\n\nNote: ${content}`,
        config: { responseMimeType: "application/json" }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to analyze content" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lumina Server running on http://localhost:${PORT}`);
  });
}

startServer();
