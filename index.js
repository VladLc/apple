import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();

/**
 * ✅ CORS FULL (permite orice domeniu)
 */
app.use(cors({
  origin: "https://frontapple.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "x-domain"
  ]
}));

// 🔴 OBLIGATORIU pentru preflight
app.options("*", cors());

app.use(express.json());

// ---------------- CONFIG ----------------
const PSP_URL = process.env.PSP_URL;
const API_KEY = process.env.UNIVERSAL_API_KEY;
const TERMINAL = process.env.VB_TERMINAL;
const PORT = process.env.PORT || 3000;
const DOMAIN_NAME = "https://www.foisoare.md";
// ----------------------------------------

/**
 * 1️⃣ Apple Pay – Merchant Session
 */
app.post("/apple-pay-session", async (req, res) => {
  try {
    console.log("🔗 Apple Pay session start");

    const response = await fetch(PSP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-domain": "frontapple.vercel.app"
      },
      body: JSON.stringify({
        terminal: TERMINAL,
        validationURL: req.body.validationURL // forward daca e nevoie
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        error: "PSP error",
        details: text
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (err) {
    console.error("❌ Apple Pay session error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2️⃣ Procesare plata (Apple Pay / card demo)
 */
app.post("/process-apple-pay", async (req, res) => {
  try {
    const { amount, order, paymentToken } = req.body;

    if (!amount || !order) {
      return res.status(400).json({ error: "Missing amount or order" });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);

    const nonce = Math.random().toString(36).substring(2, 12);

    // DEMO signature
    const signature = "DEMO_SIGNATURE";

    const params = new URLSearchParams({
      AMOUNT: amount,
      CURRENCY: "498",
      ORDER: order,
      TERMINAL: TERMINAL,
      TRTYPE: "0",
      DESC: "Apple Pay Payment",
      MERCH_NAME: "TEST",
      MERCH_URL: DOMAIN_NAME,
      COUNTRY: "MD",
      TIMESTAMP: timestamp,
      NONCE: nonce,
      P_SIGN: signature,
      BACKREF: `${DOMAIN_NAME}/success`,
      APPLE_PAY_TOKEN: Buffer.from(
        JSON.stringify(paymentToken || {})
      ).toString("base64"),
      CVC2_RC: "2"
    });

    const vbRes = await axios.post(
      "https://vb059.vb.md/cgi-bin/cgi_link",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    res.status(200).json({
      success: true,
      gatewayResponse: vbRes.data
    });

  } catch (err) {
    console.error("❌ Payment error:", err);
    res.status(500).json({ error: "Bank request failed" });
  }
});

/**
 * 3️⃣ Health check
 */
app.get("/", (req, res) => {
  res.send("✅ API is running (CORS: *)");
});

app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
