const express = require('express');
const routerSummary = express.Router();
const fs = require('fs');
const path = require('path');

const multer = require('multer');

const { splitPDF, generateSummary } = require('../utils/documentgenerator');

const cohereAPIKey = process.env.COHERE_API_KEY;
const mongoUrl = process.env.MONGO_CONNECTION_STRING;

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      path.parse(file.originalname).name +
        '-' +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  },
});

// Summarize using PDF
/**
 * @swagger
 * /api/summarize/summarize-using-pdf:
 *   post:
 *     summary: Upload a PDF file to train AI Model
 *     tags: [summarize-model]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: The PDF file to upload
 *     responses:
 *       200:
 *         description: Summary of PDF Is provided

 *       400:
 *         description: No PDF file uploaded
 *       500:
 *         description: Error processing PDF
 */
routerSummary.post(
  '/summarize-using-pdf',
  upload.single('pdf'),
  async (req, res) => {
    try {
      const file = req.file;
      const { originalname, filename } = file;

      if (!file) {
        return res.status(400).send('No PDF file uploaded');
      }

      console.log('Uploaded file ' + filename);

      //1.  Loading & Splitting PDF
      const fileToBeLoaded = `./uploads/${filename}`;
      const docs = await splitPDF(fileToBeLoaded,10000,250);

      //2.Generate Summary of the document
      const summary = await generateSummary(docs, cohereAPIKey);

      await fs.unlink(fileToBeLoaded, (err) => {
        console.log('File deletion error ', err);
      });
      //3. Returning uploaded file details
      res.json({ success: true, data: summary });
    } catch (error) {
      console.error('Error processing PDF:', error);
      res.status(500).send('Error processing PDF');
    }
  }
);

module.exports = routerSummary;
