'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- obras ---
    await queryInterface.createTable('obras', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // --- capitulos ---
    await queryInterface.createTable('capitulos', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      link: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      pipelineStatus: {
        type: Sequelize.ENUM('idle', 'downloading', 'extracting', 'done', 'error'),
        allowNull: false,
        defaultValue: 'idle'
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      obraId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'obras', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // --- imagens ---
    await queryInterface.createTable('imagens', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      filename: {
        type: Sequelize.STRING,
        allowNull: true
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'downloaded', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      ocrData: {
        type: Sequelize.JSON,
        allowNull: true
      },
      capituloId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'capitulos', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // --- extractions ---
    await queryInterface.createTable('extractions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      imagemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'imagens', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      bbox: {
        type: Sequelize.JSON,
        allowNull: true
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      language: {
        type: Sequelize.STRING(16),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'done', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      translatedText: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      translatedLang: {
        type: Sequelize.STRING(8),
        allowNull: true
      },
      translateStatus: {
        type: Sequelize.ENUM('pending', 'done', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('extractions', ['imagemId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('extractions');
    await queryInterface.dropTable('imagens');
    await queryInterface.dropTable('capitulos');
    await queryInterface.dropTable('obras');
  }
};
