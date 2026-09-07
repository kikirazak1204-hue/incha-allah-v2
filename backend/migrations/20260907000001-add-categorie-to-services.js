'use strict';

// Migration : ajoute la colonne `categorie` à la table `services`.
//
// Indispensable : frontend/src/config/servicesConfig.js route l'affichage
// du formulaire de réservation en fonction de service.categorie (valeurs
// attendues : 'panne', 'rendez_vous', 'divertissement', 'voyage',
// 'mission_freelance', 'benevolat'). Sans cette colonne, chaque service
// retombe systématiquement sur le formulaire générique 'default'.
//
// Après cette migration, il faut mettre à jour chaque service existant
// avec la bonne valeur de categorie (aucune valeur automatique fiable ne
// peut être déduite du nom du service) :
//
//   UPDATE services SET categorie = 'panne' WHERE nom IN (...);
//   UPDATE services SET categorie = 'rendez_vous' WHERE nom IN (...);
//   -- etc. pour chacune des 30+ prestations.

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('services', 'categorie', {
            type: Sequelize.STRING(50),
            allowNull: true,
            defaultValue: 'default'
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('services', 'categorie');
    }
};