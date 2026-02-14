"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('extractions', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      imagemId: { type: Sequelize.INTEGER, allowNull: false },
      bbox: { type: Sequelize.JSON, allowNull: true },
      text: { type: Sequelize.TEXT, allowNull: true },
      confidence: { type: Sequelize.FLOAT, allowNull: true },
      language: { type: Sequelize.STRING(16), allowNull: true },
      status: { type: Sequelize.ENUM('pending','done','failed'), allowNull: false, defaultValue: 'pending' },
      translatedText: { type: Sequelize.TEXT, allowNull: true },
      translatedLang: { type: Sequelize.STRING(8), allowNull: true },
      translateStatus: { type: Sequelize.ENUM('pending','done','failed'), allowNull: false, defaultValue: 'pending' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('extractions', ['imagemId']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('extractions');
  }
};
