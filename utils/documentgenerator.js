const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { JSONLoader } = require('langchain/document_loaders/fs/json');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const {
  CheerioWebBaseLoader,
} = require('@langchain/community/document_loaders/web/cheerio');
const {
  HtmlToTextTransformer,
} = require('@langchain/community/document_transformers/html_to_text');
const{ Cohere} = require('@langchain/cohere');
const { PromptTemplate } = require('@langchain/core/prompts');
const { loadSummarizationChain } = require("langchain/chains");

async function splitPDF(fileToBeLoaded,chunkSize,overlap) {
  console.log('Loading PDF File');
  console.log(' File to be loaded/ split: ' + fileToBeLoaded);
  const loader = new PDFLoader(fileToBeLoaded);
  const data = await loader.load();
  console.log('PDF File Loaded');

  //3:Splitting document into chunks
  console.log('Splitting PDF File');
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    chunkOverlap: overlap,
  });
  const docs = await textSplitter.splitDocuments(data);

  console.log('PDF File Split');
  return docs;
}

async function splitWebsiteDetails(website) {
  const loader = new CheerioWebBaseLoader(website);

  const docs = await loader.load();

  const splitter = RecursiveCharacterTextSplitter.fromLanguage('html');
  const transformer = new HtmlToTextTransformer();

  const sequence = splitter.pipe(transformer);

  const newDocuments = await sequence.invoke(docs);

  return newDocuments;
}

async function splitJson(filename) {
  const filePath = `./uploads/${filename}`;
  const loader = new JSONLoader(filePath);
  const jsonDoc = await loader.load();
  
 
  console.log('Json  File Split',jsonDoc);
  return jsonDoc;
}

async function generateSummary(docs,cohereAPIKey){
  const modelCohere = new Cohere({
    maxTokens: 1000,
    apiKey: cohereAPIKey, // In Node.js defaults to process.env.COHERE_API_KEY
  });
/*
const llmSummary = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
  temperature: 0.3,
});
*/

const summaryTemplate = `
You are an expert in summarizing pdf documents.
Your goal is to create a summary of pdf document.
Below you find data in the pdf:
--------
{text}
--------

The pdf will also be used as the basis for a question and answer bot.
Provide some examples questions and answers that could be asked about the pdf. Make these questions very specific.

Total output will be a summary of the data in pdf and a list of example questions the user could ask of the pdf.

SUMMARY AND QUESTIONS:
`;

const SUMMARY_PROMPT = PromptTemplate.fromTemplate(summaryTemplate);

const summaryRefineTemplate = `
You are an expert in summarizing PDF documents.
Your goal is to create a summary of a PDF.
We have provided an existing summary up to a certain point: {existing_answer}

Below you find the content of PDF:
--------
{text}
--------

Given the new context, refine the summary and example questions.
The pdf will also be used as the basis for a question and answer bot.
Provide some examples questions and answers that could be asked about the pdf. Make
these questions very specific.
If the context isn't useful, return the original summary and questions.
Total output will be a summary of the pdf and a list of example questions the user could ask of the pdf.

SUMMARY AND QUESTIONS:
`;

const SUMMARY_REFINE_PROMPT = PromptTemplate.fromTemplate(
  summaryRefineTemplate
);

const summarizeChain = loadSummarizationChain(modelCohere, {
  type: "refine",
  verbose: false,
  questionPrompt: SUMMARY_PROMPT,
  refinePrompt: SUMMARY_REFINE_PROMPT,
});

const summary = await summarizeChain.run(docs);

console.log(summary);
return summary;
}

module.exports = { splitPDF, splitWebsiteDetails ,generateSummary,splitJson};
