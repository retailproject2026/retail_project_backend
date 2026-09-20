const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();
app.use(cors({
  origin: 'https://retailproject2026.github.io',  //http://localhost:4200
  credentials: true
}));

app.use(express.json());


app.post("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "razorpay-backend",
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    )
  });
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay Order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid amount"
      });
    }

    const options = {
      amount: Math.round(amount * 100), // INR -> paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error("Razorpay order creation failed", {
      statusCode: error.statusCode,
      code: error.error?.code,
      description: error.error?.description
    });

    if (error.statusCode === 401) {
      return res.status(502).json({
        success: false,
        message: "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to create Razorpay order"
    });
  }
});
const crypto = require("crypto");

app.post("/api/verify", (req, res) => {

  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(body)
        .digest("hex");

    const isValid =
      expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    // Payment is verified
    console.log("Payment verified:", razorpay_payment_id);

    res.json({
      success: true,
      message: "Payment verified successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
});
 const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});