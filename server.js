import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const users = [];
const chats = [];

const settings = {
  premiumPrice: 199,
  freeDailyLimit: 10
};

function tokenFor(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    process.env.JWT_SECRET || "dev-only-secret",
    {
      expiresIn: "7d"
    }
  );
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        error: "Login required"
      });
    }

    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-only-secret"
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Bolo AI Backend",
    owner: "Sabroj Babu"
  });
});


/* =========================
   SIGNUP
========================= */

app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password || password.length < 6) {
    return res.status(400).json({
      error: "Valid email and 6+ character password required"
    });
  }

  const normalizedEmail = email.toLowerCase();

  if (users.some(user => user.email === normalizedEmail)) {
    return res.status(409).json({
      error: "Account already exists"
    });
  }

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    plan: "free"
  };

  users.push(user);

  res.json({
    token: tokenFor(user),
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan
    }
  });
});


/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  const user = users.find(
    user => user.email === String(email || "").toLowerCase()
  );

  if (
    !user ||
    !(await bcrypt.compare(password || "", user.password))
  ) {
    return res.status(401).json({
      error: "Wrong email or password"
    });
  }

  res.json({
    token: tokenFor(user),
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan
    }
  });
});


/* =========================
   CURRENT USER
========================= */

app.get("/api/me", auth, (req, res) => {
  const user = users.find(
    user => user.id === req.user.id
  );

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan
  });
});


/* =========================
   SETTINGS
========================= */

app.get("/api/settings", (req, res) => {
  res.json(settings);
});


/* =========================
   BOLO AI CHAT
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(
      req.body?.message || ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        error: "Message required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured on the server."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini returned an empty response."
      });
    }

    chats.push({
      message,
      reply,
      createdAt: new Date().toISOString()
    });

    res.json({
      reply
    });

  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      error: "Bolo AI could not generate a response."
    });
  }
});


/* =========================
   PAYMENT PLACEHOLDER
========================= */

app.post("/api/payment/create-order", auth, (req, res) => {
  res.status(503).json({
    error: "Payment gateway is not connected."
  });
});


app.post("/api/payment/webhook", (req, res) => {
  res.status(501).json({
    error: "Payment webhook is not configured."
  });
});


/* =========================
   ADMIN STATS
========================= */

app.get("/api/admin/stats", (req, res) => {
  res.json({
    users: users.length,
    premium: users.filter(
      user => user.plan === "premium"
    ).length,
    revenue: 0
  });
});


/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Bolo AI backend running on port ${PORT}`
  );
});
