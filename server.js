
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
 FREE / ANONYMOUS MODE
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
    AI Horde anonymous API key.
    किसी personal image API key की जरूरत नहीं।
    */

    const HORDE_API_KEY = "0000000000";

    /*
    --------------------------------------------------
    STEP 1: CREATE IMAGE REQUEST
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
            width: 512,
            height: 512,
            steps: 15,
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
      console.error(
        "AI Horde Generate Error:",
        generateData
      );

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
        error:
          "AI Horde ने generation ID नहीं दिया।",
      });
    }

    console.log(
      "AI Horde Generation ID:",
      generationId
    );

    /*
    --------------------------------------------------
    STEP 2: CHECK GENERATION
    --------------------------------------------------

    Official lightweight check endpoint.
    इसमें image download नहीं होती।
    */

    const maxAttempts = 36;

    let isDone = false;

    let lastCheckData = null;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      /*
      5 seconds wait
      */

      await new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );

      const checkResponse = await fetch(
        `https://stablehorde.net/api/v2/generate/check/${generationId}`,
        {
          method: "GET",

          headers: {
            apikey: HORDE_API_KEY,
            Accept: "application/json",
          },
        }
      );

      const checkData =
        await checkResponse.json();

      lastCheckData = checkData;

      console.log(
        `AI Horde Check ${attempt + 1}:`,
        checkData
      );

      if (!checkResponse.ok) {
        console.error(
          "AI Horde Check Error:",
          checkData
        );

        return res.status(500).json({
          ok: false,
          error:
            checkData?.message ||
            checkData?.error ||
            "Image generation status नहीं मिल पाया।",
        });
      }

      /*
      Generation complete
      */

      if (checkData?.done === true) {
        isDone = true;
        break;
      }
    }

    /*
    --------------------------------------------------
    STEP 3: TIMEOUT
    --------------------------------------------------
    */

    if (!isDone) {
      return res.status(504).json({
        ok: false,
        error:
          "Image generation में ज्यादा समय लग रहा है। AI Horde अभी busy है, थोड़ी देर बाद फिर कोशिश करें।",
        status: lastCheckData,
      });
    }

    /*
    --------------------------------------------------
    STEP 4: GET FULL GENERATION STATUS
    --------------------------------------------------

    अब image सहित पूरा result लेते हैं।
    */

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

    const statusData =
      await statusResponse.json();

    console.log(
      "AI Horde Final Status:",
      statusData
    );

    if (!statusResponse.ok) {
      return res.status(500).json({
        ok: false,
        error:
          statusData?.message ||
          statusData?.error ||
          "Generated image status नहीं मिल पाया।",
      });
    }

    /*
    --------------------------------------------------
    STEP 5: GET IMAGE
    --------------------------------------------------
    */

    const generation =
      statusData?.generations?.[0];

    if (!generation) {
      return res.status(500).json({
        ok: false,
        error:
          "AI Horde ने generation complete बताया लेकिन image नहीं मिली।",
      });
    }

    if (!generation.img) {
      return res.status(500).json({
        ok: false,
        error:
          "AI Horde ने image URL नहीं दिया।",
      });
    }

    /*
    --------------------------------------------------
    STEP 6: DOWNLOAD IMAGE
    --------------------------------------------------
    */

    try {
      const imageResponse = await fetch(
        generation.img
      );

      /*
      अगर image download नहीं हुई,
      तो direct URL भेज देंगे।
      */

      if (!imageResponse.ok) {
        console.error(
          "Image download failed:",
          imageResponse.status
        );

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

      /*
      ------------------------------------------------
      FINAL SUCCESS
      ------------------------------------------------
      */

      return res.json({
        ok: true,

        image:
          `data:${contentType};base64,${base64Image}`,

        width: 512,
        height: 512,
      });
    } catch (downloadError) {
      console.error(
        "Image Download Error:",
        downloadError
      );

      /*
      Direct URL fallback
      */

      return res.json({
        ok: true,
        image: generation.img,
      });
    }
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
