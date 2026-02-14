const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_NAME = process.env.DB_NAME || 'leitor_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false
});

const db = { sequelize, Sequelize, DataTypes };

// Import models
const Obra = require('./obra')(sequelize, DataTypes);
const Capitulo = require('./capitulo')(sequelize, DataTypes);
const Imagem = require('./imagem')(sequelize, DataTypes);
const Extraction = require('./extraction')(sequelize, DataTypes);

// Associations
Obra.hasMany(Capitulo, { foreignKey: 'obraId', onDelete: 'CASCADE' });
Capitulo.belongsTo(Obra, { foreignKey: 'obraId' });
// Alias the images association explicitly to avoid Sequelize pluralization inconsistencies
Capitulo.hasMany(Imagem, { foreignKey: 'capituloId', onDelete: 'CASCADE', as: 'Imagens' });
Imagem.belongsTo(Capitulo, { foreignKey: 'capituloId' });
Imagem.hasMany(Extraction, { foreignKey: 'imagemId', onDelete: 'CASCADE' });
Extraction.belongsTo(Imagem, { foreignKey: 'imagemId' });

db.Obra = Obra;
db.Capitulo = Capitulo;
db.Imagem = Imagem;
db.Extraction = Extraction;

module.exports = db;
