const cloudinary = require("cloudinary").v2;

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

function ensureConfigured() {
  if (!isConfigured) {
    const error = new Error("Cloudinary is not configured");
    error.statusCode = 503;
    throw error;
  }
}

function uploadImage(buffer, options = {}) {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "uploads",
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

function getImageUrl(publicId, options = {}) {
  ensureConfigured();

  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    ...options
  });
}

module.exports = {
  getImageUrl,
  isConfigured,
  uploadImage
};