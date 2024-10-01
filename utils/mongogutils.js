const { MongoClient, ObjectId } = require('mongodb');
const MongoDBAtlasVectorSearch =
  require('@langchain/mongodb').MongoDBAtlasVectorSearch;

const CohereEmbeddings = require('@langchain/cohere').CohereEmbeddings;

async function generateAndSaveVectorEmbeddings(
  mongoUrl,
  documents,
  apiKey,
  index
) {
  //Conencting to mongo db
  const client = new MongoClient(mongoUrl);

  const dbName = 'vector-embeddings';
  const collectionName = 'vector-embeddings';

  const collection = client.db(dbName).collection(collectionName);

  // Creating vector embeddings  for Mongodb atlas using cohere
  console.log('Adding vector store to db');
  const vectorstore = await MongoDBAtlasVectorSearch.fromDocuments(
    documents,
    new CohereEmbeddings({
      model: 'embed-multilingual-v3.0',
      apiKey: apiKey,
    }),
    {
      collection,
      indexName: index, // The name of the Atlas search index. Defaults to "default"
      textKey: 'text', // The name of the collection field containing the raw content. Defaults to "text"
      embeddingKey: 'embedding', // The name of the collection field containing the embedded text. Defaults to "embedding"
    }
  );

  console.log('vector store saved to db');
  //Closing Mongo db client
  await client.close();
}

async function getChatHistory(mongoUrl, chatHistoryId) {
  //Fetch chat history from db if available, else insert a new instance
  const client = new MongoClient(mongoUrl);
  const collectionHistory = client
    .db('vector-embeddings')
    .collection('chat_history');
  let customHistory = [];
  if (!chatHistoryId) {
    customHistory = {
      humanMessages: [
        'My name is Prashant Hariharan. I am looking for answers related to the document. Can you help me?',
      ],
      aiMessages: ['Hi Prashant, I can help you in many ways.'],
    };

    const historyDoc = await collectionHistory.insertOne({ customHistory });

    customHistory = await collectionHistory.findOne({
      _id: historyDoc.insertedId,
    });
  } else {
    const _id = new ObjectId(chatHistoryId);
    customHistory = await collectionHistory.findOne({ _id: _id });
  }
  return customHistory;
}
async function updateChatHistory(mongoUrl, customChatHistory) {
  //Fetch chat history from db if available, else insert a new instance
  const client = new MongoClient(mongoUrl);
  const collectionHistory = client
    .db('vector-embeddings')
    .collection('chat_history');
  await collectionHistory.updateOne(
    { _id: customChatHistory._id },
    {
      $set: {
        'customHistory.humanMessages':
          customChatHistory.customHistory.humanMessages,
        'customHistory.aiMessages': customChatHistory.customHistory.aiMessages,
      },
    }
  );
}

module.exports = {
  generateAndSaveVectorEmbeddings,
  getChatHistory,
  updateChatHistory,
};
