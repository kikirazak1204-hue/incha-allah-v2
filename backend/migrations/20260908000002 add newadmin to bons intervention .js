'use strict';

// Ajoute le niveau d'administration hiérarchique (section 39.T du cahier
// des charges) : SUPER_ADMIN > ADMIN > AGENT > COMPTABILITE > OPERATIONS.
// NULL pour les non-admins (clients, prestataires) — seul un compte avec
// role='admin' a un niveauAdmin pertinent.

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('users', 'niveauAdmin', {
            type: Sequelize.STRING(30),
            allowNull: true,
            defaultValue: null
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('users', 'niveauAdmin');
    }
};