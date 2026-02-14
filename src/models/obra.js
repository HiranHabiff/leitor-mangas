module.exports = (sequelize, DataTypes) => {
  const Obra = sequelize.define('Obra', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    tableName: 'obras',
    timestamps: true
  });

  return Obra;
};
