'use strict';

// Migration : ajoute la colonne `heureIntervention` à la table `reservations`.
// Même cause que la migration précédente sur `services` : le champ est
// déclaré dans backend/models/Reservation.js depuis le début, mais
// sequelize.sync() (sans { alter: true }) n'ajoute jamais de colonne à une
// table déjà existante — d'où l'erreur en production :
// "Unknown column 'heureIntervention' in 'field list'".

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('reservations', 'heureIntervention', {
            type: Sequelize.STRING(20),
            allowNull: true
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('reservations', 'heureIntervention');
    }
};