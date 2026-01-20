import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(express.json());

const PSP_URL = process.env.PSP_URL; // https://api-start-session.vercel.app/applepay/session
const API_KEY = process.env.UNIVERSAL_API_KEY;
const TERMINAL = process.env.VB_TERMINAL;
const PORT = process.env.PORT || 3000;
const DOMAIN_NAME = "https://apple-eta-lime.vercel.app/";

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
        "x-domain": "apple-eta-lime.vercel.app/", // ✅ ADAUGAT conform cerintei
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
 * 2️⃣ Procesare Apple Pay și trimitere la banca VB (demo fără VB_PRIVATE_KEY)
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

    // ⚠️ Fără VB_PRIVATE_KEY → simulăm semnătura
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
      APPLE_PAY_TOKEN: Buffer.from(JSON.stringify(paymentToken || {})).toString(
        "base64",
      ),
      CVC2_RC: "2",
    });

    // Trimitem la banca VB (demo)
    const vbRes = await axios.post(
      "https://vb059.vb.md/cgi-bin/cgi_link",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const body = typeof vbRes.data === "string" ? vbRes.data : "";
    let rc = null;
    let action = null;
    try {
      const rcMatch = body.match(/name=["']RC["']\s+value=["']([^"']+)["']/i);
      const actionMatch = body.match(
        /name=["']ACTION["']\s+value=["']([^"']+)["']/i,
      );
      rc = rcMatch ? rcMatch[1] : "00"; // dacă nu găsim, simulăm aprobat
      action = actionMatch ? actionMatch[1] : "SALE";
    } catch {}

    const approved = rc === "1" || rc === "00";
    res
      .status(200)
      .json({ success: approved, rc, action, gatewayResponse: body });
  } catch (err) {
    console.error("❌ Eroare VB:", err);
    res.status(500).json({ error: "Eroare trimitere catre banca" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server pornit pe portul ${PORT}`);
});
