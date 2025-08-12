// backend/api/middleware/upload.middleware.js

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config(); // Ensure environment variables are loaded

// Configure Cloudinary with your credentials from .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up Cloudinary storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rd-panshop-products', // The folder name on Cloudinary where images will be stored
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif'], // Allowed image formats
    // Optional: You can add transformations to resize images upon upload
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  },
});

// Function to check that only image files are uploaded
function checkFileType(file, cb){
  // Allowed file extensions and mime types
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype){
    return cb(null, true);
  } else {
    // If the file is not an image, pass an error
    cb('Error: Only image files (jpeg, jpg, png, gif) are allowed!');
  }
}

// Initialize the upload middleware with the new Cloudinary storage
const uploadMiddleware = multer({
  storage: storage, // Use the Cloudinary storage engine
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit file size to 2MB
  fileFilter: function(req, file, cb){
    checkFileType(file, cb);
  }
}).array('productImages', 4); // Expecting up to 4 files from the 'productImages' field

module.exports = uploadMiddleware;
