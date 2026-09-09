'use strict';

// Ajoute les colonnes permettant de tracer, pour CHAQUE bon d'intervention,
// le taux de commission réellement appliqué et les montants qui en
// découlent — jamais recalculés après coup, même si le taux standard
// change plus tard (cohérent avec la règle du cahier des charges section
// 39.D : "ne jamais modifier rétroactivement la commission d'une ancienne
// transaction").

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('bons_intervention', 'tauxCommissionApplique', {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true
        });
        await queryInterface.addColumn('bons_intervention', 'montantCommission', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true
        });
        await queryInterface.addColumn('bons_intervention', 'montantNet', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('bons_intervention', 'tauxCommissionApplique');
        await queryInterface.removeColumn('bons_intervention', 'montantCommission');
        await queryInterface.removeColumn('bons_intervention', 'montantNet');
    }
};