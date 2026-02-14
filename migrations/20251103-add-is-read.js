'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('capitulos', 'isRead', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'pipelineStatus'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('capitulos', 'isRead');
  }
};
