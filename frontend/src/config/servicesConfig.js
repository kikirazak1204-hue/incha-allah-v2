// Fichier : src/config/servicesConfig.js

export const CONFIG_SERVICES = {
    panne: {
        titre: "Signaler une Panne / Urgence",
        actionBouton: "Demander une intervention",
        typeFormulaire: 'reservation',
        paiementObligatoire: true,
        collectif: false,
        champs: [
            { id: 'adresse', type: 'text', label: 'Adresse de l\'intervention', requis: true, placeholder: 'Où se situe la panne ?' },
            {
                id: 'urgence', type: 'select', label: 'Niveau d\'urgence', requis: true,
                options: ['Basse (Dans les 48h)', 'Moyenne (Dans la journée)', 'Haute (Immédiat - Majoration)']
            },
            { id: 'description', type: 'textarea', label: 'Description du problème', requis: true, placeholder: 'Ex: Fuite d\'eau sous l\'évier...' }
        ]
    },

    rendez_vous: {
        titre: "Prendre un Rendez-vous",
        actionBouton: "Confirmer le rendez-vous",
        typeFormulaire: 'reservation',
        paiementObligatoire: true,
        collectif: false,
        champs: [
            { id: 'date', type: 'date', label: 'Date souhaitée', requis: true, demiLargeur: true },
            { id: 'heure', type: 'time', label: 'Heure souhaitée', requis: true, demiLargeur: true },
            { id: 'adresse', type: 'text', label: 'Lieu du rendez-vous', requis: true },
            { id: 'description', type: 'textarea', label: 'Détails ou demandes spécifiques', requis: false }
        ]
    },

    divertissement: {
        titre: "Créer ou Rejoindre un Événement",
        actionBouton: "Valider l'événement",
        typeFormulaire: 'reservation',
        paiementObligatoire: true,
        collectif: 'optionnel',
        champs: [
            { id: 'lieu', type: 'text', label: 'Lieu souhaité', requis: true },
            { id: 'date', type: 'datetime-local', label: 'Date et Heure', requis: true },
            { id: 'nombrePersonnes', type: 'number', label: 'Nombre de participants estimé', requis: true, demiLargeur: true },
            { id: 'budgetVise', type: 'number', label: 'Budget total estimé (FCFA)', requis: true, demiLargeur: true },
            {
                id: 'visibilite', type: 'select', label: 'Visibilité de l\'événement', requis: true,
                options: ['Privé (Sur invitation uniquement)', 'Public (Ouvert à tous sur Kanari)']
            }
        ]
    },

    voyage: {
        titre: "Réserver un Trajet",
        actionBouton: "Valider mon voyage",
        typeFormulaire: 'reservation',
        paiementObligatoire: true,
        collectif: false,
        champs: [
            { id: 'nom', type: 'text', label: 'Nom', requis: true, demiLargeur: true },
            { id: 'prenom', type: 'text', label: 'Prénom', requis: true, demiLargeur: true },
            { id: 'adresseDepart', type: 'text', label: 'Point de départ', requis: true, placeholder: 'D\'où partez-vous ?' },
            { id: 'adresseArrivee', type: 'text', label: 'Point d\'arrivée', requis: true, placeholder: 'Où allez-vous ?' },
            { id: 'date', type: 'datetime-local', label: 'Date et heure de départ', requis: true }
        ]
    },

    mission_freelance: {
        titre: "Devenir Prestataire / Postuler",
        actionBouton: "Soumettre mon profil",
        typeFormulaire: 'candidature', // Pas de paiement ici !
        paiementObligatoire: false,
        collectif: false,
        champs: [
            { id: 'nom', type: 'text', label: 'Nom', requis: true, demiLargeur: true },
            { id: 'prenom', type: 'text', label: 'Prénom', requis: true, demiLargeur: true },
            {
                id: 'competenceDeclaree', type: 'select', label: 'Domaine de compétence', requis: true,
                options: ['Manutention/Déménagement', 'Informatique & Tech', 'Bricolage/Travaux', 'Livraison', 'Esthétique/Coiffure']
            },
            { id: 'age', type: 'number', label: 'Âge', requis: true, demiLargeur: true },
            {
                id: 'poids', type: 'number', label: 'Poids (kg)', requis: false, demiLargeur: true,
                conditionAffiche: (valeursActuelles) => valeursActuelles.competenceDeclaree === 'Manutention/Déménagement'
            },
            {
                id: 'troubles', type: 'textarea', label: 'Contre-indications médicales', requis: false,
                placeholder: "Ex: Problème de dos, asthme... (Important pour votre sécurité)",
                conditionAffiche: (valeursActuelles) => valeursActuelles.competenceDeclaree === 'Manutention/Déménagement'
            }
        ]
    },

    benevolat: {
        titre: "Proposer ou Chercher du Bénévolat",
        actionBouton: "Valider ma demande",
        typeFormulaire: 'candidature', // Pas de paiement
        paiementObligatoire: false,
        collectif: false,
        champs: [
            { id: 'lieu', type: 'text', label: 'Lieu ou Zone d\'action', requis: true },
            { id: 'date', type: 'date', label: 'Date de disponibilité', requis: true },
            { id: 'description', type: 'textarea', label: 'Description de la mission / motivation', requis: true }
        ]
    },

    // Catégorie de repli — s'applique à tout service dont le champ
    // `categorie` (backend/models/Service.js) n'a pas encore été renseigné
    // ou ne correspond à aucune des clés ci-dessus. Sans elle, un service
    // non catégorisé afficherait un formulaire totalement vide.
    default: {
        titre: "Demande de service",
        actionBouton: "Confirmer la demande",
        typeFormulaire: 'reservation',
        paiementObligatoire: false,
        collectif: false,
        champs: [
            { id: 'description', type: 'textarea', label: 'Précisez votre besoin', requis: true, placeholder: 'Détaillez votre demande pour le prestataire...' }
        ]
    }
};