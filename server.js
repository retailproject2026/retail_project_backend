const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const multer = require("multer");
require("dotenv").config();
const { getImageUrl, isConfigured: cloudinaryConfigured, uploadImage } = require("./cloudinaryService");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed"));
    }

    callback(null, true);
  }
});

app.post('/api/test-db', async (req, res) => {
  try {
    // Fetch the first record from the Maintenance collection
   
    res.json({'test': 'Database connection successful'});
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database connection test failed', details: error.message });
  }
});
app.post("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "razorpay-backend",
    cloudinaryConfigured,
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    )
  });
});

const razorpay = new Razorpay({
  key_id:  process.env.RAZORPAY_KEY_ID,
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
app.post("/api/cloudinary/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "An image is required in the image field"
      });
    }

    const result = await uploadImage(req.file.buffer, {
      folder: req.body.folder
    });

    res.status(201).json({
      success: true,
      image: {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format
      }
    });
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 503 ? error.message : "Unable to upload image"
    });
  }
});

app.get("/api/cloudinary/image", (req, res) => {
  try {
    const { publicId } = req.query;

    if (!publicId || typeof publicId !== "string") {
      return res.status(400).json({
        success: false,
        message: "publicId query parameter is required"
      });
    }

    res.json({
      success: true,
      publicId,
      url: getImageUrl(publicId)
    });
  } catch (error) {
    console.error("Cloudinary image URL generation failed:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 503 ? error.message : "Unable to get image"
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE" ? "Image must be 10 MB or smaller" : error.message
    });
  }

  next(error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});