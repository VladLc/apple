import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";

dotenv.config();

const app = express();

/**
 * ✅ CORS DESCHIS PENTRU TOATE ORIGIN-URILE
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  }),
);

// răspunde corect la preflight
app.options("*", cors());

app.use(express.json());

const PSP_URL = process.env.PSP_URL; // https://api-start-session.vercel.app/applepay/session
const API_KEY = process.env.UNIVERSAL_API_KEY;
const TERMINAL = process.env.VB_TERMINAL;
const PORT = process.env.PORT || 3000;
const DOMAIN_NAME = "https://frontapple.vercel.app";

/**
 * 1️⃣ Start Session Apple Pay
 */
app.post("/apple-pay-session", async (req, res) => {
  try {
    console.log("🔗 Pornim validarea Apple Pay prin PSP:", PSP_URL);

    const response = await fetch(PSP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-domain": "frontapple.vercel.app",
      },
      body: JSON.stringify({ terminal: TERMINAL }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Eroare PSP:", text);
      return res.status(500).json({ error: "Eroare de la PSP", details: text });
    }

    const data = await response.json();
    console.log("✅ Merchant Session primit:", data);
    res.json(data);
  } catch (err) {
    console.error("❌ Eroare validare merchant:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2️⃣ Procesare Apple Pay și trimitere la banca VB (demo)
 */
app.post("/process-apple-pay", async (req, res) => {
  try {
    const { amount, order, paymentToken } = req.body;

    if (!amount || !order) {
      return res.status(400).json({ error: "Lipsesc amount sau order" });
    }

    const trtype = "0";
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);
    const nonce = Math.random().toString(36).substring(2, 12);

    const signature = "DEMO_SIGNATURE";

    const params = new URLSearchParams({
      AMOUNT: amount,
      CURRENCY: "498",
      ORDER: order,
      TERMINAL: TERMINAL,
      TRTYPE: trtype,
      DESC: "Apple Pay Payment",
      MERCH_NAME: "TEST",
      MERCH_URL: DOMAIN_NAME,
      COUNTRY: "MD",
      TIMESTAMP: timestamp,
      NONCE: nonce,
      P_SIGN: signature,
      BACKREF: `${DOMAIN_NAME}/success`,
      APPLE_PAY_TOKEN: Buffer.from(
        JSON.stringify(paymentToken || {}),
      ).toString("base64"),
      CVC2_RC: "2",
    });

    const vbRes = await axios.post(
      "https://vb059.vb.md/cgi-bin/cgi_link",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const body = typeof vbRes.data === "string" ? vbRes.data : "";
    let rc = "00";
    let action = "SALE";

    try {
      const rcMatch = body.match(/name=["']RC["']\s+value=["']([^"']+)["']/i);
      const actionMatch = body.match(
        /name=["']ACTION["']\s+value=["']([^"']+)["']/i,
      );
      if (rcMatch) rc = rcMatch[1];
      if (actionMatch) action = actionMatch[1];
    } catch {}

    const approved = rc === "1" || rc === "00";

    res.status(200).json({
      success: approved,
      rc,
      action,
      gatewayResponse: body,
    });
  } catch (err) {
    console.error("❌ Eroare VB:", err);
    res.status(500).json({ error: "Eroare trimitere catre banca" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
