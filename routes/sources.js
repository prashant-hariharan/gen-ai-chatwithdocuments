const express = require('express');
const routerSources = express.Router();

const { MongoClient } = require('mongodb');



const mongoUrl = process.env.MONGO_CONNECTION_STRING;

/**
 * @swagger
 * /api/sources/trained-models:
 *   get:
 *    summary: List Sources
 *    tags: [sources]
 *    description: Get all available source
 *    responses:
 *      200:
 *        description: Get all available source
 */
routerSources.get('/trained-models', async (req, res) => {
    const client = new MongoClient(mongoUrl);
    const dbName = 'vector-embeddings';
    const collectionName = 'vector-embeddings';
  
    const output = await client
      .db(dbName)
      .collection(collectionName)
      .aggregate([
        { $match: { source: { $ne: null } } },
        {
          $group: {
            _id: '$source',
          },
        },
      ])
      .toArray();
  
    const source = output.map((data) => {
      if (data && data._id) {
        return data._id;
      }
    });
  
    res.json(source);
  });
  
  /**
   * @swagger
   * /api/sources/chathistory:
   *   get:
   *    summary: List Sources for chat history
   *    tags: [sources]
   *    description: Get all available source
   *    responses:
   *      200:
   *        description: Get all available source for chat history
   */
  routerSources.get('/chathistory', async (req, res) => {
    const client = new MongoClient(mongoUrl);
    const dbName = 'vector-embeddings';
    const collectionName = 'chat_history';
  
    const output = await client
      .db(dbName)
      .collection(collectionName)
      .aggregate([
        { $project: { _idString: { $toString: "$_id" } , _id:0 } }
    ])
      .toArray();
  
    const source = output.map((data) => {
      if (data && data._idString) {
        return data._idString;
      }
    });
  
    res.json(source);
  });
  module.exports = routerSources;