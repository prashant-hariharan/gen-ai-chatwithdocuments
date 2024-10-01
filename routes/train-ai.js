const express = require('express');
const routerTrain = express.Router();
const fs = require('fs');
const path = require('path');

const multer = require('multer');
const { promisify } = require('util');

const { generateAndSaveVectorEmbeddings } = require('../utils/mongogutils');

const { splitPDF, splitWebsiteDetails, splitJson } = require('../utils/documentgenerator');

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

// Train using PDF
/**
 * @swagger
 * /api/train/train-using-pdf:
 *   post:
 *     summary: Upload a PDF file to train AI Model
 *     tags: [train-model]
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
 *         description: AI Trained successfully using PDF

 *       400:
 *         description: No PDF file uploaded
 *       500:
 *         description: Error processing PDF
 */
routerTrain.post('/train-using-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    const { originalname, filename } = file;

    if (!file) {
      return res.status(400).send('No PDF file uploaded');
    }

    console.log('Uploaded file ' + filename);

    //1.  Loading & Splitting PDF
    const fileToBeLoaded = `./uploads/${filename}`;
    const docs = await splitPDF(fileToBeLoaded,200,20);

    //2. Creating vector embeddings  for Mongodb atlas using cohere
    console.log('Generating and saving vector embeddings');

    await generateAndSaveVectorEmbeddings(
      mongoUrl,
      docs,
      cohereAPIKey,
      'vector_index'
    );

    await fs.unlink(fileToBeLoaded, err=> {
      if(err) {
        console.log('File deletion error ', err);
      }
     
    });
    //3. Returning uploaded file details
    res.json({ success: true, data: file });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).send('Error processing PDF');
  }
});

// Train using website
/**
 * @swagger
 * /api/train/train-using-website:
 *   post:
 *     summary: Provide a website to train the AI Model
 *     tags: [train-model]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               website:
 *                 type: string
 *                 description: Website which should be used for training the model
 *                 example: https://www.mathema.de
 *
 *     description: Train the AI Model using Website
 *     responses:
 *       200:
 *         description: AI Model trained successfully using website
 */
routerTrain.post('/train-using-website', async (req, res) => {
  try {
    console.log('Train using website');
    const website = req.body.website;
    console.log(website);

    //1. Load Website and split the data of provided website
    const docs = await splitWebsiteDetails(website);

    //2. Creating vector embeddings  for Mongodb atlas using cohere
    console.log('Generating and saving vector embeddings');
    await generateAndSaveVectorEmbeddings(
      mongoUrl,
      docs,
      cohereAPIKey,
      'vector_index'
    );

    //3. Returning trianed website
    res.json({ success: true, data: website });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).send('Error processing PDF');
  }
});

// Train using json
/**
 * @swagger
 * /api/train/train-using-json:
 *   post:
 *     summary: Provide a website to train the AI Model
 *     tags: [train-model]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               
 *
 *     description: Train the AI Model using Json
 *     responses:
 *       200:
 *         description: AI Model trained successfully using Json
 */
routerTrain.post('/train-using-json', async (req, res) => {
  try {
    console.log('Train using json');
    const json = req.body;

    const timestamp = Date.now();
  const filename = `data-${timestamp}.json`;
  const filePath = path.join(uploadDir, filename);

  const jsonAsString = JSON.stringify(json);

  const writeFile = promisify(fs.writeFile);

  await writeFile(filePath,jsonAsString);
  console.log('temp file created '+ filePath);


    //1. Load Website and split the data of provided website
    const docs = await splitJson( filename);
    //console.log('Json  File Unsplit',docs);
   

    //2. Creating vector embeddings  for Mongodb atlas using cohere
    console.log('Generating and saving vector embeddings');
    await generateAndSaveVectorEmbeddings(
      mongoUrl,
      docs,
      cohereAPIKey,
      'vector_index'
    );

     fs.unlink(filePath, err=> {
      if(err) {
        console.log('File deletion error ', err);
      }
     
    });



    
    res.json({ success: true, data: json });
  } catch (error) {
    console.error('Error processing Json:', error);
    res.status(500).send('Error processing Json');
  }
});



module.exports = routerTrain;
