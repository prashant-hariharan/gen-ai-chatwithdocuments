require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { rateLimit } = require('express-rate-limit');

const port = process.env.PORT || 5000;

const app = express();

// define the rate limiting middleware
const limiterQueryApi = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 5, // each IP can make up to 5 requests per `windowsMs` (1 minutes)
  standardHeaders: true, // add the `RateLimit-*` headers to the response
  legacyHeaders: false, // remove the `X-RateLimit-*` headers from the response
});

const limiterTrainandSummaryAPI = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 2, // each IP can make up to 2 requests per `windowsMs` (1 minutes)
  standardHeaders: true, // add the `RateLimit-*` headers to the response
  legacyHeaders: false, // remove the `X-RateLimit-*` headers from the response
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cors middleware
app.use(
  cors({
    origin: ['http://localhost:5000', 'http://localhost:4200'],
    credentials: true,
  })
);

//Home page
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Gen AI API' });
});

//Initialize Swagger
const initializeSwagger = require('./config/swagger');
initializeSwagger(app);

//APi routes
const trainAiRoute = require('./routes/train-ai');
const queryAiRoute = require('./routes/query-ai');
const summaryAiRoute = require('./routes/summarize-ai');
const sourcesRoute = require('./routes/sources');

app.use('/api/train', limiterTrainandSummaryAPI, trainAiRoute);
app.use('/api/query', limiterQueryApi, queryAiRoute);
app.use('/api/summarize', limiterTrainandSummaryAPI, summaryAiRoute);
app.use('/api/sources', sourcesRoute);

const server = app.listen(port, () =>
  console.log(`Server listening on port ${port}`)
);
server.timeout = 60000;
//app.all('*', authenticationRequired); // Require authentication for all routes

module.exports = app;
