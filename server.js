
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;

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

app.use(express.json({ limit: "2mb" }));

// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu",
    message: "Bolo AI Backend is running"
  });
});

// ========================================
// HEALTH
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu"
  });
});

// ========================================
// CHAT - GROQ
// ========================================

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
          error:
            "AI की free limit अभी पूरी हो गई है। थोड़ी देर बाद फिर कोशिश करें।"
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
    console.error("Chat server error:", error);

    return res.status(500).json({
      ok: false,
      error: "AI server से connection नहीं हो पाया।"
    });
  }
});

// ========================================
// IMAGE GENERATION - POLLINATIONS
// ========================================

app.post("/api/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "Image prompt खाली है।"
      });
    }

    if (!POLLINATIONS_API_KEY) {
      console.error("POLLINATIONS_API_KEY is missing.");

      return res.status(500).json({
        ok: false,
        error: "Image AI अभी configure नहीं है।"
      });
    }

    console.log("Image prompt:", prompt);

    const model = "black-forest-labs/flux.1-schnell";

    const width = 1024;
    const height = 1024;

    const imageUrl =
      `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}` +
      `?model=${encodeURIComponent(model)}` +
      `&width=${width}` +
      `&height=${height}` +
      `&safe=true`;

    const response = await fetch(imageUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${POLLINATIONS_API_KEY}`,
        "Accept": "image/*"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Pollinations image error:",
        response.status,
        errorText
      );

      if (response.status === 401) {
        return res.status(500).json({
          ok: false,
          error: "Pollinations API key गलत या unauthorized है।"
        });
      }

      if (response.status === 402) {
        return res.status(402).json({
          ok: false,
          error:
            "Image generation के लिए available Pollen balance/credits पर्याप्त नहीं हैं।"
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          ok: false,
          error:
            "Image generation की limit अभी पूरी हो गई है। थोड़ी देर बाद फिर कोशिश करें।"
        });
      }

      return res.status(500).json({
        ok: false,
        error: "Image generate नहीं हो पाई।"
      });
    }

    const contentType =
      response.headers.get("content-type") || "image/png";

    const imageBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    console.log("Image generated successfully.");

    return res.json({
      ok: true,
      image: `data:${contentType};base64,${imageBuffer.toString("base64")}`
    });

  } catch (error) {
    console.error("Image generation server error:", error);

    return res.status(500).json({
      ok: false,
      error: "Image AI server से connection नहीं हो पाया।"
    });
  }
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`Bolo AI backend running on port ${PORT}`);
});
