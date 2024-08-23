const MongoDBAtlasVectorSearch =
  require('@langchain/mongodb').MongoDBAtlasVectorSearch;
exports.MongoDBAtlasVectorSearch = MongoDBAtlasVectorSearch;
const CohereEmbeddings = require('@langchain/cohere').CohereEmbeddings;
exports.CohereEmbeddings = CohereEmbeddings;
const { MongoClient } = require('mongodb');
const { Cohere } = require('@langchain/cohere');

const { ChatPromptTemplate,MessagesPlaceholder } = require('@langchain/core/prompts');
const { formatDocumentsAsString } = require('langchain/util/document');
const {
  RunnablePassthrough,
  RunnableSequence,
} = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');

const { createHistoryAwareRetriever } = require('langchain/chains/history_aware_retriever');
const { createStuffDocumentsChain } = require( 'langchain/chains/combine_documents');
const { createRetrievalChain } = require ('langchain/chains/retrieval');

const { HumanMessage, AIMessage } = require ( "@langchain/core/messages");

async function getVectorStoreAsRetriver(mongoUrl, cohereAPIKey, index, source) {
  //Conencting to mongo db
  const client = new MongoClient(mongoUrl);

  const dbName = 'vector-embeddings';
  const collectionName = 'vector-embeddings';

  const collection = client.db(dbName).collection(collectionName);

  const vectorStore = new MongoDBAtlasVectorSearch(
    new CohereEmbeddings({
      model: 'embed-multilingual-v3.0',
      apiKey: cohereAPIKey,
    }),
    {
      collection,
      indexName: index, // The name of the Atlas search index. Defaults to "default"
      textKey: 'text', // The name of the collection field containing the raw content. Defaults to "text"
      embeddingKey: 'embedding', // The name of the collection field containing the embedded text. Defaults to "embedding"
    }
  );

  let retriever;
  if (source) {
    retriever = await vectorStore.asRetriever({
      searchType: 'mmr',
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
      filter: { preFilter: { source: { $eq: source } } },
      // filter: { preFilter: JSON.stringify(filter) }
    });
  } else {
    //3.fetch the Retriever from vector store
    retriever = await vectorStore.asRetriever({
      searchType: 'mmr',
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });
  }

  return retriever;
}

//Helper method to provide string representation for the retrived vectors.
//this will be use as a context later

/*
function formatDocumentsAsString(documents) {
  return documents.map((document) => document.pageContent).join('\n\n');
}
  */

async function answerQuestion(question, chain) {
  console.log('Question : ', { question });
  // Invoking chain
  let answer = await chain.invoke(question);

  console.log({ answer });
  return answer;
}

async function answerQuestionWithHistory(question, conversationChain,history,mongoUrl) {
  const chatHistory = [];
   
  history.customHistory.humanMessages.forEach((element) => {
    chatHistory.push(new HumanMessage(element));
  });
  history.customHistory.aiMessages.forEach((element) => {
    chatHistory.push(new AIMessage(element));
  });
 

  console.log("Question : " , { question });
  // Invoking chain
  let response = await conversationChain.invoke({
    chat_history: chatHistory,
    input:question,
  });
  console.log( response.answer );
  history.customHistory.humanMessages.push(question);
  history.customHistory.aiMessages.push(response.answer);

  return response.answer;
}

async function generateRAGRetreivalChain(cohereAPIKey, retriever) {
  //3.Implement RAG. ie based on the response from vector embeddings, query LLM

  //3.1 - Formulating Template and giving context

  // Create a system & human prompt for the chat model
  const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------------
    {context}`;
  //----------------
  //Chat History: {chat_history}`;

  //3.2 defining models to use for LLM

  const modelCohere = new Cohere({
    maxTokens: 1000,
    apiKey: cohereAPIKey, // In Node.js defaults to process.env.COHERE_API_KEY
  });

  //3.3 - Creating Prompt template

  //how to include chat history here?

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
    // new MessagesPlaceholder('chat_history'),
    ['human', '{question}'],
  ]);

  const chain = RunnableSequence.from([
    {
      //setting context based on the retrived vector
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
      //chat_history: new RunnablePassthrough(),
    },
    prompt,
    modelCohere,
    new StringOutputParser(),
  ]);
  return chain;
}

async function generateRAGRetreivalChainWithHistory(
  cohereAPIKey,
  retriever
) {

  const modelCohere = new Cohere({
    maxTokens: 1000,
    apiKey: cohereAPIKey, // In Node.js defaults to process.env.COHERE_API_KEY
  });



  // Create a HistoryAwareRetriever which will be responsible for
// generating a search query based on both the user input and
// the chat history
const retrieverPrompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder('chat_history'),
  ['user', '{input}'],
  [
    'user',
    'Given the above conversation, generate a search query to look up in order to get information relevant to the conversation',
  ],
]);

// This chain will return a list of documents from the vector store
const retrieverChain = await createHistoryAwareRetriever({
  llm: modelCohere,
  retriever,
  rephrasePrompt: retrieverPrompt,
});

const RAG_TEMPLATE = `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;
//----------------
// Define the prompt for the final chain
const RAG_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', RAG_TEMPLATE],
  new MessagesPlaceholder('chat_history'),
  ['user', '{input}'],
]);


const chain = await createStuffDocumentsChain({
  llm: modelCohere,
  prompt: RAG_PROMPT,
});


// Create the conversation chain, which will combine the retrieverChain
// and combineStuffChain in order to get an answer
const conversationChain = await createRetrievalChain({
  combineDocsChain: chain,
  retriever: retrieverChain,
});

  return conversationChain;
}

module.exports = {

  getVectorStoreAsRetriver,
  answerQuestion,
  answerQuestionWithHistory,
  generateRAGRetreivalChain,
  generateRAGRetreivalChainWithHistory,
 
};
