'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('capitulos', 'pipelineStatus', {
      type: Sequelize.ENUM('idle', 'downloading', 'extracting', 'done', 'error'),
      allowNull: false,
      defaultValue: 'idle',
      after: 'link'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('capitulos', 'pipelineStatus');
  }
};
