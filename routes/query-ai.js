const express = require('express');
const routerQuery = express.Router();


const {
  generateRAGRetreivalChainWithHistory,
  getVectorStoreAsRetriver,
  answerQuestion,
  answerQuestionWithHistory,
  generateRAGRetreivalChain,

} = require('../utils/vectorutils')
const {
  updateChatHistory,
  getChatHistory,
} = require('../utils/mongogutils');




const cohereAPIKey = process.env.COHERE_API_KEY;
const mongoUrl = process.env.MONGO_CONNECTION_STRING;


// Prompt
/**
 * @swagger
 * /api/query/prompt:
 *   post:
 *     tags: [query]
 *     summary: API to query the model
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Query to be asked to the AI Model
 *                 example: What is the cost of BBQ Chicken
 *               source:
 *                 type: string
 *                 description: Source of the AI Model.
 *                 example: ./uploads/lunch-1723456221030.pdf
 *
 *     description: Query the AI Model
 *     responses:
 *       200:
 *         description: Output Of Query
 */
routerQuery.post('/prompt', async (req, res) => {
  console.log('Querying AI Model');
  try {
    const query = req.body.query;
    const source = req.body.source;

    if (!query || !source) {
      return res.status(400).send('Please provide Source as well as the query');
    }

    const retriever = await getVectorStoreAsRetriver(
      mongoUrl,
      cohereAPIKey,
      'vector_index',
      source
    );

    const chain = await generateRAGRetreivalChain(cohereAPIKey, retriever);

    const answer = await answerQuestion(query, chain);

    res.json({ success: true, data: answer });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

// Prompt With History
/**
 * @swagger
 * /api/query/prompt-with-history:
 *   post:
 *     tags: [query]
 *     summary: API to query the model
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Query to be asked to the AI Model
 *                 example: I would like to add different toppings based on your previous suggestion
 *                 
 *               source:
 *                 type: string
 *                 description: Source of the AI Model.
 *                 example: ./uploads/lunch-1723456221030.pdf
 *               chatHistoryId:
 *                 type: ObjectId
 *                 description: Chat history id if present, else new will be created
 *                 example: "66c5d3a2062538f1bf7076d0"
 *
 *     description: Query the AI Model using chat history
 *     responses:
 *       200:
 *         description: Output Of Query
 */
routerQuery.post('/prompt-with-history', async (req, res) => {
  console.log('Querying AI Model With chat history');
  try {
    const query = req.body.query;
    const source = req.body.source;
    const chatHistoryId = req.body.chatHistoryId;

    if (!query || !source) {
      return res.status(400).send('Please provide Source as well as the query');
    }

    const retriever = await getVectorStoreAsRetriver(
      mongoUrl,
      cohereAPIKey,
      'vector_index',
      source
    );
    const customChatHistory = await getChatHistory(mongoUrl,chatHistoryId);

  
    const chain = await generateRAGRetreivalChainWithHistory(cohereAPIKey, retriever);

    const answer = await answerQuestionWithHistory(query, chain,customChatHistory);
    
   await updateChatHistory(mongoUrl,customChatHistory );

    res.json({ success: true, data: answer });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

module.exports = routerQuery;
