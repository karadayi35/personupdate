import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Resend } from "resend";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Initialize using environment variables (Vercel/Production)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log("Firebase Admin initialized successfully using environment variables.");
    } else {
      // Fallback to service-account.json (Local Development)
      const serviceAccountPath = path.join(process.cwd(), "service-account.json");
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully with service account for project:", serviceAccount.project_id);
      } else {
        console.warn("WARNING: Firebase Admin credentials not found (env vars or service-account.json). Auth features will fail.");
      }
    }
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route for sending emails
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ 
        error: "RESEND_API_KEY is not set in environment variables." 
      });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Personel Takip Sistemi <noreply@turkishdentistconnect.com>",
        to: [to],
        subject: subject,
        html: html,
      });

      if (error) {
        console.error("Resend API error:", error);
        return res.status(400).json({ error: error.message || "Failed to send email via Resend." });
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ error: "An unexpected error occurred while sending email." });
    }
  });

  // API Route for creating Firebase Auth user
  app.post("/api/create-user", async (req, res) => {
    const { email, password, displayName } = req.body;

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
      res.status(200).json({ success: true, uid: userRecord.uid });
    } catch (error) {
      console.error("Auth user creation error:", error);
      let errorMessage = error instanceof Error ? error.message : "Failed to create user.";
      
      const projectId = process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID";
      if (errorMessage.includes("Identity Toolkit API")) {
        errorMessage = `Identity Toolkit API is disabled in project ${projectId}. Please enable it in the Google Cloud Console: https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  // API Route for deleting Firebase Auth user
  app.post("/api/delete-user", async (req, res) => {
    const { uid } = req.body;
    try {
      await admin.auth().deleteUser(uid);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Auth user deletion error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete user." });
    }
  });

  // API Route for updating Firebase Auth user status
  app.post("/api/update-user-status", async (req, res) => {
    const { uid, disabled } = req.body;
    try {
      await admin.auth().updateUser(uid, { disabled });
      await admin.auth().revokeRefreshTokens(uid);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Auth user status update error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update user status." });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if not on Vercel (Vercel handles the serverless execution)
  if (process.env.VERCEL !== '1') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
