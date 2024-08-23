const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

//Swagger documentation
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.1', 
    info: {
      title: 'Gen AI REST API',
      description: 'A REST API built with Express and MongoDB to provide RAG based querying features with Gen AI.',
    },
  },

  apis: ['./routes/query-ai.js', './routes/train-ai.js','./routes/summarize-ai.js','./routes/sources.js'],
};

const initializeSwagger = (app) => {
  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};

module.exports = initializeSwagger;
