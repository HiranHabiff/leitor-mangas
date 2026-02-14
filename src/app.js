const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const { sequelize } = require('./models');
const obrasRouter = require('./routes/obras');
const capitulosRouter = require('./routes/capitulos');
const apiRouter = require('./routes/api');
const uiRouter = require('./routes/ui');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware: allow extension pages and external origins (preflight)
app.use((req, res, next) => {
  // You can tighten this in production to the exact origin(s) you trust
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API routes
app.use('/obras', obrasRouter);
// mount capitulos router under /obras/:obraId/capitulos
app.use('/obras/:obraId/capitulos', capitulosRouter);
// extension-dedicated API
app.use('/api', apiRouter);

// UI routes (server rendered)
app.use('/', uiRouter);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start app:', err);
    process.exit(1);
  }
})();
