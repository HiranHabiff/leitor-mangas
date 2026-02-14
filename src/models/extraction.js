module.exports = (sequelize, DataTypes) => {
  const Extraction = sequelize.define('Extraction', {
    imagemId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    bbox: { type: DataTypes.JSON, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: true },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    language: { type: DataTypes.STRING(16), allowNull: true },
    status: { type: DataTypes.ENUM('pending','done','failed'), allowNull: false, defaultValue: 'pending' },
    translatedText: { type: DataTypes.TEXT, allowNull: true },
    translatedLang: { type: DataTypes.STRING(8), allowNull: true },
    translateStatus: { type: DataTypes.ENUM('pending','done','failed'), allowNull: false, defaultValue: 'pending' }
  }, {
    tableName: 'extractions'
  });

  Extraction.associate = function(models) {
    Extraction.belongsTo(models.Imagem, { foreignKey: 'imagemId' });
  };

  return Extraction;
};
