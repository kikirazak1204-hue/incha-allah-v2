'use strict';

// Migration : ajoute la colonne `services` (JSON) à la table `reservations`.
//
// Cause : backend/models/Reservation.js déclare ce champ depuis l'origine
// (`services: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }`),
// mais server.js utilise `sequelize.sync()` SANS `{ alter: true }` au
// démarrage — ce qui crée les tables manquantes mais ne modifie JAMAIS une
// table déjà existante. La colonne n'a donc jamais été appliquée sur la
// base Aiven, même si le modèle la déclarait. Le bug n'était pas visible
// avant parce qu'aucun code n'écrivait réellement dans ce champ ; le
// nouveau createGlobalReservation (qui y stocke les détails dynamiques du
// formulaire) est le premier à l'utiliser, d'où l'erreur qui apparaît
// maintenant : "Unknown column 'services' in 'field list'".

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('reservations', 'services', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: []
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('reservations', 'services');
    }
};