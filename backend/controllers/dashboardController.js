const {
    Produit, Commande,
    CommandeProduit, Fournisseur, User, Reservation, BonIntervention
} = require('../models');

exports.getDashboardFournisseur = async (req, res) => {
    try {
        const fournisseur = await Fournisseur.findOne({
            where: { userId: req.user.id },
            include: [{ model: User, as: 'userFournisseur', attributes: ['id', 'nom', 'email', 'telephone'] }]
        });
        if (!fournisseur) return res.status(404).json({ success: false, message: 'Profil non trouvé' });

        const fId = fournisseur.id;
        const [totalProduits, totalCommandes, missions, commandesRecentes, bonsValides] = await Promise.all([
            Produit.count({ where: { fournisseurId: fId } }),
            Commande.count({ where: { fournisseurId: fId } }),
            Reservation.findAll({
                where: { fournisseurId: fId },
                include: [
                    { model: User, as: 'client', attributes: ['nom', 'email', 'telephone'] },
                    { model: BonIntervention, as: 'bonIntervention' }
                ],
                limit: 20,
                order: [['createdAt', 'DESC']]
            }),
            Commande.findAll({
                where: { fournisseurId: fId },
                include: [
                    { model: User, as: 'clientCommande', attributes: ['nom'] },
                    {
                        model: CommandeProduit,
                        as: 'itemsCommande',
                        include: [{ model: Produit, as: 'produitCommandeProduit', attributes: ['nom'] }]
                    }
                ],
                limit: 5,
                order: [['createdAt', 'DESC']]
            }),
            // ── Vrais montants de commission : plus de "10%" codé en dur.
            // On lit directement les bons validés de ce fournisseur, dont
            // le taux/montant de commission a été figé au moment de la
            // validation (voir bonInterventionController.js).
            BonIntervention.findAll({
                where: { fournisseurId: fId, valide: true }
            })
        ]);

        const totalBrut = bonsValides.reduce((acc, b) => acc + Number(b.montantFinal || 0), 0);
        const totalCommission = bonsValides.reduce((acc, b) => acc + Number(b.montantCommission || 0), 0);
        const totalNet = bonsValides.reduce((acc, b) => acc + Number(b.montantNet ?? (Number(b.montantFinal || 0) - Number(b.montantCommission || 0))), 0);

        const maintenant = new Date();
        const bonsValidesCeMois = bonsValides.filter(b => {
            const d = new Date(b.valideLe || b.createdAt);
            return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear();
        });
        const brutMois = bonsValidesCeMois.reduce((acc, b) => acc + Number(b.montantFinal || 0), 0);
        const commissionMois = bonsValidesCeMois.reduce((acc, b) => acc + Number(b.montantCommission || 0), 0);
        const netMois = brutMois - commissionMois;

        const profil = {
            ...fournisseur.toJSON(),
            statutKanari: fournisseur.statut,
            email: fournisseur.userFournisseur?.email || null,
            telephone: fournisseur.userFournisseur?.telephone || null,
            nom: fournisseur.nomEntreprise || fournisseur.userFournisseur?.nom || null
        };

        res.json({
            success: true,
            data: {
                profil,
                stats: {
                    totalProduits,
                    totalCommandes,
                    totalMissions: missions.length,
                    totalBrut,
                    totalCommission,
                    totalNet,
                    totalRevenus: netMois,
                    brutMois,
                    commissionMois,
                    netMois
                },
                missions,
                commandesRecentes
            }
        });
    } catch (err) {
        console.error('❌ Erreur Critique:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur interne' });
    }
};

exports.getDashboardClient = async (req, res) => {
    try {
        const clientId = req.user.id;

        const [missions, totalReservations] = await Promise.all([
            Reservation.findAll({
                where: { clientId },
                include: [
                    { model: Fournisseur, as: 'prestataire', attributes: ['id', 'nomEntreprise', 'telephone'] },
                    { model: BonIntervention, as: 'bonIntervention' }
                ],
                limit: 20,
                order: [['createdAt', 'DESC']]
            }),
            Reservation.count({ where: { clientId } })
        ]);

        res.json({
            success: true,
            data: {
                stats: { totalReservations },
                missions
            }
        });
    } catch (err) {
        console.error('❌ Erreur Critique (dashboard client):', err);
        res.status(500).json({ success: false, message: 'Erreur serveur interne' });
    }
};