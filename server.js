
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/*
====================================================
 BOLO AI BACKEND
 Owner: Sabroj Babu
====================================================
*/

const ADMIN_EMAIL =
  "Sabrojalam8454@gmail.com";

/*
====================================================
 FIREBASE ADMIN INITIALIZATION
====================================================
*/

let firebaseReady = false;

try {
  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountRaw) {
    console.warn(
      "⚠️ FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
    );
  } else {
    const serviceAccount =
      JSON.parse(serviceAccountRaw);

    admin.initializeApp({
      credential:
        admin.credential.cert(serviceAccount),
    });

    firebaseReady = true;

    console.log(
      "✅ Firebase Admin connected."
    );
  }
} catch (error) {
  console.error(
    "❌ Firebase Admin initialization failed:",
    error.message
  );
}

/*
====================================================
 FIRESTORE
====================================================
*/

const db = () => {
  if (!firebaseReady) {
    throw new Error(
      "Firebase Admin is not configured."
    );
  }

  return admin.firestore();
};

/*
====================================================
 CORS
====================================================
*/

app.use(
  cors({
    origin: [
      "https://bolo-ai-five.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
    ],

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/*
====================================================
 JSON
====================================================
*/

app.use(
  express.json({
    limit: "12mb",
  })
);

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
    message:
      "Bolo AI Backend is running",
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
    firebase:
      firebaseReady
        ? "connected"
        : "not-configured",
  });
});

/*
====================================================
 FIREBASE AUTH MIDDLEWARE
====================================================
*/

async function verifyFirebaseUser(
  req,
  res,
  next
) {
  try {
    if (!firebaseReady) {
      return res.status(503).json({
        ok: false,
        error:
          "Firebase Admin अभी configure नहीं है।",
      });
    }

    const authHeader =
      req.headers.authorization || "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        ok: false,
        error:
          "Authentication token जरूरी है।",
      });
    }

    const idToken =
      authHeader.substring(7);

    const decodedToken =
      await admin
        .auth()
        .verifyIdToken(idToken);

    req.firebaseUser =
      decodedToken;

    next();
  } catch (error) {
    console.error(
      "Firebase Auth Error:",
      error.message
    );

    return res.status(401).json({
      ok: false,
      error:
        "Authentication token invalid या expired है।",
    });
  }
}

/*
====================================================
 ADMIN AUTH MIDDLEWARE
====================================================
*/

async function verifyAdmin(
  req,
  res,
  next
) {
  try {
    await verifyFirebaseUser(
      req,
      res,
      async () => {
        const email =
          String(
            req.firebaseUser?.email ||
              ""
          )
            .trim()
            .toLowerCase();

        if (
          email !==
          ADMIN_EMAIL.toLowerCase()
        ) {
          return res.status(403).json({
            ok: false,
            error:
              "Admin access नहीं है।",
          });
        }

        next();
      }
    );
  } catch (error) {
    console.error(
      "Admin Auth Error:",
      error
    );

    return res.status(403).json({
      ok: false,
      error:
        "Admin authorization failed.",
    });
  }
}

/*
====================================================
 USER ACTIVITY
====================================================
*/

app.post(
  "/api/user/activity",
  verifyFirebaseUser,
  async (req, res) => {
    try {
      const user =
        req.firebaseUser;

      const uid = user.uid;

      const userRef = db()
        .collection("users")
        .doc(uid);

      const existing =
        await userRef.get();

      const now =
        admin.firestore.FieldValue.serverTimestamp();

      if (!existing.exists) {
        await userRef.set({
          uid,

          name:
            user.name ||
            user.email?.split("@")[0] ||
            "User",

          email:
            user.email || "",

          photoURL:
            user.picture || "",

          role:
            user.email?.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
              ? "admin"
              : "user",

          createdAt: now,
          lastLoginAt: now,
          lastSeenAt: now,

          loginCount: 1,
        });
      } else {
        await userRef.set(
          {
            name:
              user.name ||
              existing.data()?.name ||
              "User",

            email:
              user.email ||
              existing.data()?.email ||
              "",

            photoURL:
              user.picture ||
              existing.data()?.photoURL ||
              "",

            lastLoginAt: now,
            lastSeenAt: now,

            loginCount:
              admin.firestore.FieldValue.increment(
                1
              ),
          },
          {
            merge: true,
          }
        );
      }

      return res.json({
        ok: true,
        message:
          "User activity recorded.",
      });
    } catch (error) {
      console.error(
        "User Activity Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "User activity save नहीं हो सकी।",
      });
    }
  }
);

/*
====================================================
 USER HEARTBEAT
====================================================
*/

app.post(
  "/api/user/heartbeat",
  verifyFirebaseUser,
  async (req, res) => {
    try {
      const uid =
        req.firebaseUser.uid;

      await db()
        .collection("users")
        .doc(uid)
        .set(
          {
            lastSeenAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

      return res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Heartbeat Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Activity update failed.",
      });
    }
  }
);

/*
====================================================
 AI MESSAGE ANALYTICS
====================================================
*/

app.post(
  "/api/analytics/message",
  verifyFirebaseUser,
  async (req, res) => {
    try {
      const uid =
        req.firebaseUser.uid;

      const userRef = db()
        .collection("users")
        .doc(uid);

      await userRef.set(
        {
          lastSeenAt:
            admin.firestore.FieldValue.serverTimestamp(),

          aiMessages:
            admin.firestore.FieldValue.increment(
              1
            ),
        },
        {
          merge: true,
        }
      );

      return res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "Analytics Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Analytics save नहीं हो सकी।",
      });
    }
  }
);

/*
====================================================
 CHAT + PHOTO VISION - GROQ
====================================================
*/

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const message =
        String(
          req.body?.message || ""
        ).trim();

      const image =
        req.body?.image || null;

      if (!message && !image) {
        return res.status(400).json({
          ok: false,
          error:
            "Message या photo जरूरी है।",
        });
      }

      const GROQ_API_KEY =
        process.env.GROQ_API_KEY;

      if (!GROQ_API_KEY) {
        return res.status(500).json({
          ok: false,
          error:
            "AI service अभी configure नहीं है।",
        });
      }

      const model = image
        ? "qwen/qwen3.6-27b"
        : "openai/gpt-oss-20b";

      const systemMessage = `
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

When a photo is provided:
- Actually analyse the image.
- Describe what you can see.
- Read visible text when possible.
- Answer questions about objects, people, documents, screenshots and other visible content.
- Do not claim that you cannot see the image.
- If something is unclear or unreadable, say that honestly.
`;

      let userContent;

      if (image) {
        userContent = [
          {
            type: "text",
            text:
              message ||
              "Please analyse this photo and tell me what you can see.",
          },
          {
            type: "image_url",
            image_url: {
              url: image,
            },
          },
        ];
      } else {
        userContent = message;
      }

      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${GROQ_API_KEY}`,
            },

            body: JSON.stringify({
              model,

              messages: [
                {
                  role: "system",
                  content:
                    systemMessage,
                },

                {
                  role: "user",
                  content:
                    userContent,
                },
              ],

              temperature: 0.7,

              max_tokens: image
                ? 1200
                : 1000,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Groq Error:",
          data
        );

        if (
          response.status === 401
        ) {
          return res.status(500).json({
            ok: false,
            error:
              "AI API key गलत है।",
          });
        }

        if (
          response.status === 403
        ) {
          return res.status(403).json({
            ok: false,
            error:
              "इस AI model की permission उपलब्ध नहीं है।",
          });
        }

        if (
          response.status === 413
        ) {
          return res.status(413).json({
            ok: false,
            error:
              "Photo बहुत बड़ी है। छोटी photo upload करें।",
          });
        }

        if (
          response.status === 429
        ) {
          return res.status(429).json({
            ok: false,
            error:
              "AI की limit अभी पूरी हो गई है। थोड़ी देर बाद फिर कोशिश करें।",
          });
        }

        return res.status(500).json({
          ok: false,
          error:
            data?.error?.message ||
            "AI से response नहीं मिला।",
        });
      }

      const reply =
        data?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return res.status(500).json({
          ok: false,
          error:
            "AI ने कोई जवाब नहीं दिया।",
        });
      }

      return res.json({
        ok: true,
        reply,
        vision: Boolean(image),
      });
    } catch (error) {
      console.error(
        "Chat Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "AI server से connection नहीं हो पाया।",
      });
    }
  }
);

/*
====================================================
 ADMIN DASHBOARD - STATS
====================================================
*/

app.get(
  "/api/admin/stats",
  verifyAdmin,
  async (req, res) => {
    try {
      const usersSnapshot =
        await db()
          .collection("users")
          .get();

      let totalUsers = 0;
      let todayUsers = 0;
      let activeUsers = 0;
      let totalMessages = 0;

      const now = Date.now();

      const startOfToday =
        new Date();

      startOfToday.setHours(
        0,
        0,
        0,
        0
      );

      usersSnapshot.forEach(
        (doc) => {
          const data =
            doc.data();

          totalUsers++;

          /*
          Today users
          */

          const createdAt =
            data.createdAt?.toDate
              ? data.createdAt.toDate()
              : null;

          if (
            createdAt &&
            createdAt.getTime() >=
              startOfToday.getTime()
          ) {
            todayUsers++;
          }

          /*
          Active users
          Last 30 minutes
          */

          const lastSeen =
            data.lastSeenAt?.toDate
              ? data.lastSeenAt.toDate()
              : null;

          if (
            lastSeen &&
            now -
              lastSeen.getTime() <=
              30 * 60 * 1000
          ) {
            activeUsers++;
          }

          /*
          AI messages
          */

          totalMessages +=
            Number(
              data.aiMessages || 0
            );
        }
      );

      return res.json({
        ok: true,

        stats: {
          totalUsers,
          todayUsers,
          activeUsers,
          totalMessages,
        },
      });
    } catch (error) {
      console.error(
        "Admin Stats Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Admin statistics load नहीं हो सकी।",
      });
    }
  }
);

/*
====================================================
 ADMIN DASHBOARD - USERS
====================================================
*/

app.get(
  "/api/admin/users",
  verifyAdmin,
  async (req, res) => {
    try {
      const snapshot =
        await db()
          .collection("users")
          .orderBy(
            "lastSeenAt",
            "desc"
          )
          .limit(500)
          .get();

      const users = [];

      snapshot.forEach(
        (doc) => {
          const data =
            doc.data();

          users.push({
            uid:
              data.uid ||
              doc.id,

            name:
              data.name ||
              "User",

            email:
              data.email ||
              "",

            photoURL:
              data.photoURL ||
              "",

            role:
              data.role ||
              "user",

            loginCount:
              Number(
                data.loginCount || 0
              ),

            aiMessages:
              Number(
                data.aiMessages || 0
              ),

            createdAt:
              data.createdAt?.toDate
                ? data.createdAt
                    .toDate()
                    .toISOString()
                : null,

            lastLoginAt:
              data.lastLoginAt?.toDate
                ? data.lastLoginAt
                    .toDate()
                    .toISOString()
                : null,

            lastSeenAt:
              data.lastSeenAt?.toDate
                ? data.lastSeenAt
                    .toDate()
                    .toISOString()
                : null,
          });
        }
      );

      return res.json({
        ok: true,
        users,
      });
    } catch (error) {
      console.error(
        "Admin Users Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Users list load नहीं हो सकी।",
      });
    }
  }
);

/*
====================================================
 ADMIN USER DELETE
====================================================
*/

app.delete(
  "/api/admin/users/:uid",
  verifyAdmin,
  async (req, res) => {
    try {
      const uid =
        String(
          req.params.uid || ""
        ).trim();

      if (!uid) {
        return res.status(400).json({
          ok: false,
          error:
            "User UID जरूरी है।",
        });
      }

      /*
      Admin खुद को delete नहीं कर सकता।
      */

      if (
        uid ===
        req.firebaseUser.uid
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Admin account को यहाँ से delete नहीं किया जा सकता।",
        });
      }

      /*
      Firestore profile delete
      */

      await db()
        .collection("users")
        .doc(uid)
        .delete();

      /*
      Firebase Authentication user delete
      */

      try {
        await admin
          .auth()
          .deleteUser(uid);
      } catch (authError) {
        console.warn(
          "Firebase Auth delete warning:",
          authError.message
        );
      }

      return res.json({
        ok: true,
        message:
          "User successfully deleted.",
      });
    } catch (error) {
      console.error(
        "Admin Delete User Error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "User delete नहीं हो सका।",
      });
    }
  }
);

/*
====================================================
 IMAGE GENERATOR - AI HORDE
 FREE / ANONYMOUS MODE
====================================================
*/

app.post(
  "/api/generate-image",
  async (req, res) => {
    try {
      const prompt =
        String(
          req.body?.prompt || ""
        ).trim();

      if (!prompt) {
        return res.status(400).json({
          ok: false,
          error:
            "Image prompt खाली है।",
        });
      }

      const HORDE_API_KEY =
        "0000000000";

      /*
      STEP 1
      */

      const generateResponse =
        await fetch(
          "https://stablehorde.net/api/v2/generate/async",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              apikey:
                HORDE_API_KEY,

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              prompt,

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

      const generateData =
        await generateResponse.json();

      console.log(
        "AI Horde Generate Response:",
        generateData
      );

      if (
        !generateResponse.ok
      ) {
        console.error(
          "AI Horde Generate Error:",
          generateData
        );

        return res.status(
          generateResponse.status
        ).json({
          ok: false,
          error:
            generateData?.message ||
            generateData?.error ||
            "AI Horde image request failed.",
        });
      }

      const generationId =
        generateData?.id;

      if (!generationId) {
        return res.status(500).json({
          ok: false,
          error:
            "AI Horde ने generation ID नहीं दिया।",
        });
      }

      /*
      STEP 2
      */

      const maxAttempts = 36;

      let isDone = false;
      let lastCheckData = null;

      for (
        let attempt = 0;
        attempt < maxAttempts;
        attempt++
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              5000
            )
        );

        const checkResponse =
          await fetch(
            `https://stablehorde.net/api/v2/generate/check/${generationId}`,
            {
              method: "GET",

              headers: {
                apikey:
                  HORDE_API_KEY,

                Accept:
                  "application/json",
              },
            }
          );

        const checkData =
          await checkResponse.json();

        lastCheckData =
          checkData;

        console.log(
          `AI Horde Check ${
            attempt + 1
          }:`,
          checkData
        );

        if (
          !checkResponse.ok
        ) {
          return res.status(500).json({
            ok: false,
            error:
              checkData?.message ||
              checkData?.error ||
              "Image generation status नहीं मिल पाया।",
          });
        }

        if (
          checkData?.done === true
        ) {
          isDone = true;
          break;
        }
      }

      /*
      STEP 3
      */

      if (!isDone) {
        return res.status(504).json({
          ok: false,
          error:
            "Image generation में ज्यादा समय लग रहा है। थोड़ी देर बाद फिर कोशिश करें।",

          status:
            lastCheckData,
        });
      }

      /*
      STEP 4
      */

      const statusResponse =
        await fetch(
          `https://stablehorde.net/api/v2/generate/status/${generationId}`,
          {
            method: "GET",

            headers: {
              apikey:
                HORDE_API_KEY,

              Accept:
                "application/json",
            },
          }
        );

      const statusData =
        await statusResponse.json();

      console.log(
        "AI Horde Final Status:",
        statusData
      );

      if (
        !statusResponse.ok
      ) {
        return res.status(500).json({
          ok: false,
          error:
            statusData?.message ||
            statusData?.error ||
            "Generated image status नहीं मिल पाया।",
        });
      }

      /*
      STEP 5
      */

      const generation =
        statusData
          ?.generations?.[0];

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
      STEP 6
      */

      try {
        const imageResponse =
          await fetch(
            generation.img
          );

        if (
          !imageResponse.ok
        ) {
          console.error(
            "Image download failed:",
            imageResponse.status
          );

          return res.json({
            ok: true,
            image:
              generation.img,
          });
        }

        const contentType =
          imageResponse.headers.get(
            "content-type"
          ) ||
          "image/png";

        const imageBuffer =
          Buffer.from(
            await imageResponse.arrayBuffer()
          );

        const base64Image =
          imageBuffer.toString(
            "base64"
          );

        return res.json({
          ok: true,

          image:
            `data:${contentType};base64,${base64Image}`,

          width: 512,
          height: 512,
        });
      } catch (
        downloadError
      ) {
        console.error(
          "Image Download Error:",
          downloadError
        );

        return res.json({
          ok: true,
          image:
            generation.img,
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
  }
);

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
