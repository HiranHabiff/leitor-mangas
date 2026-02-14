require('dotenv').config();

const dbConfig = {
  username: process.env.DB_USER || 'leitor',
  password: process.env.DB_PASS || 'leitor123',
  database: process.env.DB_NAME || 'leitor_db',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
};

module.exports = {
  development: { ...dbConfig },
  test: { ...dbConfig },
  production: { ...dbConfig }
};
