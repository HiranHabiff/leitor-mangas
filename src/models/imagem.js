module.exports = (sequelize, DataTypes) => {
  const Imagem = sequelize.define('Imagem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: true
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending','downloaded','failed'),
      defaultValue: 'pending'
    },
    ocrData: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'imagens',
    timestamps: true
  });

  return Imagem;
};
