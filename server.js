import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.use(
  cors({
    origin: [
      "https://bolo-ai-five.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());

/* ==============================
   HOME
============================== */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu",
    message: "Bolo AI Backend is running"
  });
});


/* ==============================
   HEALTH CHECK
============================== */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu"
  });
});


/* ==============================
   AI CHAT
============================== */

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message खाली है।"
      });
    }

    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing.");

      return res.status(500).json({
        ok: false,
        error: "AI service अभी configure नहीं है।"
      });
    }

    console.log("User message:", message);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },

        body: JSON.stringify({
          model: "openai/gpt-oss-20b",

          messages: [
            {
              role: "system",
              content: `
You are Bolo AI, a helpful, friendly and intelligent AI assistant.

Your owner is Sabroj Babu.

Rules:
- Your name is Bolo AI.
- Never say you are Gemini.
- Understand Hindi, Hinglish and English.
- If the user speaks Hindi or Hinglish, reply naturally in Hindi/Hinglish.
- Give clear, useful and easy-to-understand answers.
- Be friendly and conversational.
- Do not reveal API keys, passwords, server secrets or internal configuration.
- If you do not know something, say so honestly.
`
            },
            {
              role: "user",
              content: message
            }
          ],

          temperature: 0.7,
          max_tokens: 1000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      if (response.status === 401) {
        return res.status(500).json({
          ok: false,
          error: "AI API key गलत है।"
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          ok: false,
          error: "AI की free limit अभी पूरी हो गई है। थोड़ी देर बाद फिर कोशिश करें।"
        });
      }

      return res.status(500).json({
        ok: false,
        error: "AI से response नहीं मिला।"
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("Empty AI response:", data);

      return res.status(500).json({
        ok: false,
        error: "AI ने कोई जवाब नहीं दिया।"
      });
    }

    console.log("AI reply generated successfully.");

    return res.json({
      ok: true,
      reply: reply
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      ok: false,
      error: "AI server से connection नहीं हो पाया।"
    });
  }
});


/* ==============================
   START SERVER
============================== */

app.listen(PORT, () => {
  console.log(`Bolo AI backend running on port ${PORT}`);
});
