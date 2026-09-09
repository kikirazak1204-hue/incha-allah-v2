const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Historique de chaque modification de paramètre (section 39.Q).
// Volontairement indépendant d'une clé étrangère stricte sur Setting :
// on veut garder l'historique même si le paramètre est un jour supprimé.
const SettingHistory = sequelize.define('SettingHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    settingCle: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    ancienneValeur: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    nouvelleValeur: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    modifiePar: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
    },
    motif: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'settings_history',
    timestamps: true,
    updatedAt: false
});

module.exports = SettingHistory;