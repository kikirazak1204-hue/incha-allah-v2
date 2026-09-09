'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('settings', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            cle: { type: Sequelize.STRING(100), allowNull: false, unique: true },
            valeur: { type: Sequelize.TEXT, allowNull: false },
            type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'STRING' },
            categorie: { type: Sequelize.STRING(50), allowNull: false },
            description: { type: Sequelize.TEXT, allowNull: true },
            modifiablePar: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'SUPER_ADMIN' },
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false }
        });

        await queryInterface.createTable('settings_history', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            settingCle: { type: Sequelize.STRING(100), allowNull: false },
            ancienneValeur: { type: Sequelize.TEXT, allowNull: true },
            nouvelleValeur: { type: Sequelize.TEXT, allowNull: false },
            modifiePar: { type: Sequelize.INTEGER, allowNull: true },
            motif: { type: Sequelize.TEXT, allowNull: true },
            createdAt: { type: Sequelize.DATE, allowNull: false }
        });

        // Valeurs initiales : uniquement les paramètres qui pilotent une
        // logique réellement en place dans le code (voir bonInterventionController.js
        // et jobs/autoValiderBonsIntervention.js).
        await queryInterface.bulkInsert('settings', [
            {
                cle: 'commission.taux_standard',
                valeur: '10',
                type: 'DECIMAL',
                categorie: 'commissions',
                description: "Taux de commission Kanari appliqué par défaut sur chaque bon d'intervention validé, en pourcentage.",
                modifiablePar: 'SUPER_ADMIN',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                cle: 'bon_intervention.delai_validation_auto_heures',
                valeur: '24',
                type: 'INTEGER',
                categorie: 'bons_intervention',
                description: "Délai, en heures, après lequel un bon d'intervention non validé par le client est validé automatiquement.",
                modifiablePar: 'ADMIN',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('settings_history');
        await queryInterface.dropTable('settings');
    }
};