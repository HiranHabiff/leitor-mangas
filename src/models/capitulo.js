module.exports = (sequelize, DataTypes) => {
  const Capitulo = sequelize.define('Capitulo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    link: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    pipelineStatus: {
      type: DataTypes.ENUM('idle', 'downloading', 'extracting', 'done', 'error'),
      allowNull: false,
      defaultValue: 'idle'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'capitulos',
    timestamps: true
  });

  return Capitulo;
};
