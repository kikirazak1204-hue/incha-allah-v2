const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Table de configuration générique (section 39.U du cahier des charges).
// Un paramètre = une clé unique, une valeur stockée en texte, un type
// déclaré pour savoir comment l'interpréter côté application.
const Setting = sequelize.define('Setting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    cle: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    valeur: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'STRING',
        validate: {
            isIn: {
                args: [['STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON', 'DATE']],
                msg: 'Type de paramètre invalide.'
            }
        }
    },
    categorie: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modifiablePar: {
        // Niveau minimum requis pour modifier ce paramètre.
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'SUPER_ADMIN',
        validate: {
            isIn: {
                args: [['SUPER_ADMIN', 'ADMIN', 'AGENT', 'COMPTABILITE', 'OPERATIONS']],
                msg: 'Niveau de permission invalide.'
            }
        }
    }
}, {
    tableName: 'settings',
    timestamps: true
});

module.exports = Setting;