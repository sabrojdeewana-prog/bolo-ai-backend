
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/*
====================================================
 BOLO AI BACKEND
 Owner: Sabroj Babu
====================================================
*/

app.use(
  cors({
    origin: [
      "https://bolo-ai-five.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "2mb" }));

/*
====================================================
 ROOT
====================================================
*/

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu",
    message: "Bolo AI Backend is running",
  });
});

/*
====================================================
 HEALTH CHECK
====================================================
*/

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu",
  });
});

/*
====================================================
 CHAT - GROQ
====================================================
*/

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: "Message खाली है।",
      });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "AI service अभी configure नहीं है।",
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
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
              `,
            },

            {
              role: "user",
              content: message,
            },
          ],

          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(500).json({
          ok: false,
          error: "AI API key गलत है।",
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          ok: false,
          error:
            "AI की free limit अभी पूरी हो गई है। थोड़ी देर बाद फिर कोशिश करें।",
        });
      }

      console.error("Groq Error:", data);

      return res.status(500).json({
        ok: false,
        error: "AI से response नहीं मिला।",
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({
        ok: false,
        error: "AI ने कोई जवाब नहीं दिया।",
      });
    }

    return res.json({
      ok: true,
      reply,
    });
  } catch (error) {
    console.error("Chat Error:", error);

    return res.status(500).json({
      ok: false,
      error: "AI server से connection नहीं हो पाया।",
    });
  }
});

/*
====================================================
 IMAGE GENERATOR - AI HORDE
 FREE COMMUNITY IMAGE GENERATION
====================================================
*/

app.post("/api/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "Image prompt खाली है।",
      });
    }

    /*
    AI Horde anonymous key.
    किसी personal API key की जरूरत नहीं।
    */

    const HORDE_API_KEY = "0000000000";

    /*
    --------------------------------------------------
    STEP 1
    Image generation request
    --------------------------------------------------
    */

    const generateResponse = await fetch(
      "https://stablehorde.net/api/v2/generate/async",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          apikey: HORDE_API_KEY,
          Accept: "application/json",
        },

        body: JSON.stringify({
          prompt: prompt,

          params: {
            width: 1024,
            height: 1024,
            steps: 25,
            cfg_scale: 7,
            n: 1,
          },

          nsfw: false,

          r2: true,
        }),
      }
    );

    const generateData = await generateResponse.json();

    console.log(
      "AI Horde Generate Response:",
      generateData
    );

    if (!generateResponse.ok) {
      return res.status(generateResponse.status).json({
        ok: false,
        error:
          generateData?.message ||
          generateData?.error ||
          "AI Horde image request failed.",
      });
    }

    const generationId = generateData?.id;

    if (!generationId) {
      return res.status(500).json({
        ok: false,
        error: "AI Horde ने generation ID नहीं दिया।",
      });
    }

    /*
    --------------------------------------------------
    STEP 2
    Generation status check
    --------------------------------------------------
    */

    const maxAttempts = 36;

    let finalData = null;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      /*
      हर 5 सेकंड में status check
      */

      await new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );

      const statusResponse = await fetch(
        `https://stablehorde.net/api/v2/generate/status/${generationId}`,
        {
          method: "GET",

          headers: {
            apikey: HORDE_API_KEY,
            Accept: "application/json",
          },
        }
      );

      const statusData = await statusResponse.json();

      console.log(
        `AI Horde Status ${attempt + 1}:`,
        {
          done: statusData?.done,
          waiting: statusData?.waiting,
          processing: statusData?.processing,
        }
      );

      if (!statusResponse.ok) {
        return res.status(500).json({
          ok: false,
          error:
            "Image generation status नहीं मिल पाया।",
        });
      }

      if (statusData?.done === true) {
        finalData = statusData;
        break;
      }
    }

    /*
    --------------------------------------------------
    STEP 3
    Timeout
    --------------------------------------------------
    */

    if (!finalData) {
      return res.status(504).json({
        ok: false,
        error:
          "Image generation में ज्यादा समय लग रहा है। AI Horde अभी busy है, थोड़ी देर बाद फिर कोशिश करें।",
      });
    }

    /*
    --------------------------------------------------
    STEP 4
    Get generated image
    --------------------------------------------------
    */

    const generation =
      finalData?.generations?.[0];

    if (!generation) {
      return res.status(500).json({
        ok: false,
        error:
          "AI Horde ने generation complete बताया लेकिन image नहीं मिली।",
      });
    }

    /*
    AI Horde generated image URL
    */

    if (generation.img) {
      try {
        const imageResponse = await fetch(
          generation.img
        );

        if (!imageResponse.ok) {
          /*
          अगर backend image download नहीं कर पाया,
          तो direct image URL भेज देंगे।
          */

          return res.json({
            ok: true,
            image: generation.img,
          });
        }

        const contentType =
          imageResponse.headers.get(
            "content-type"
          ) || "image/png";

        const imageBuffer = Buffer.from(
          await imageResponse.arrayBuffer()
        );

        const base64Image =
          imageBuffer.toString("base64");

        return res.json({
          ok: true,

          image:
            `data:${contentType};base64,${base64Image}`,
        });
      } catch (downloadError) {
        console.error(
          "Image Download Error:",
          downloadError
        );

        return res.json({
          ok: true,
          image: generation.img,
        });
      }
    }

    /*
    --------------------------------------------------
    NO IMAGE
    --------------------------------------------------
    */

    return res.status(500).json({
      ok: false,
      error: "Generated image URL नहीं मिला।",
    });
  } catch (error) {
    console.error(
      "Image Generation Error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        "Free Image AI server से connection नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।",
    });
  }
});

/*
====================================================
 SERVER START
====================================================
*/

app.listen(PORT, () => {
  console.log(
    `Bolo AI Backend running on port ${PORT}`
  );
});
