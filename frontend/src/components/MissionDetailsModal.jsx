import React, { useState, useEffect } from 'react';
import {
    autoriserDemarrage,
    assignerFournisseur,
    updateReservationStatut,
    getFournisseurs,
    getAdminFournisseurs,
    getBonInterventionParReservation
} from '../util/api';
import {
    User, Phone, MapPin, Home, Loader2, PhoneCall, Briefcase,
    AlertCircle, CheckCircle, Clock, ShieldAlert, Star, Check, FileText
} from 'lucide-react';
import { getStatutMeta } from '../constants/statuts';

export default function MissionDetailsModal({ reservation, onClose, onRefresh }) {
    // 1. ÉTATS DU COMPOSANT
    const [processing, setProcessing] = useState(false);
    const [fournisseurId, setFournisseurId] = useState(
        reservation?.fournisseurId || reservation?.fournisseur_id || ''
    );
    const [accordTelephone, setAccordTelephone] = useState(false);
    const [modeReassignation, setModeReassignation] = useState(false);

    // États pour la liste des prestataires venue du backend
    const [fournisseurs, setFournisseurs] = useState([]);
    const [loadingFournisseurs, setLoadingFournisseurs] = useState(false);

    // État pour le bon d'intervention (visible dès que la mission est TERMINEE ou VALIDEE)
    const [bon, setBon] = useState(null);
    const [loadingBon, setLoadingBon] = useState(false);

    // 2. CHARGEMENT ROBUSTE DES PRESTATAIRES
    useEffect(() => {
        const fetchListeFournisseurs = async () => {
            setLoadingFournisseurs(true);
            try {
                let data = await getFournisseurs();

                let list = Array.isArray(data)
                    ? data
                    : (data?.fournisseurs || data?.data || data?.utilisateurs || []);

                if (list.length === 0) {
                    try {
                        const adminData = await getAdminFournisseurs();
                        list = Array.isArray(adminData)
                            ? adminData
                            : (adminData?.fournisseurs || adminData?.data || []);
                    } catch (e) {
                        console.warn("Fallback admin échoué :", e);
                    }
                }

                setFournisseurs(list);
            } catch (error) {
                console.error("Erreur lors du chargement des prestataires :", error);
            } finally {
                setLoadingFournisseurs(false);
            }
        };

        if (reservation) {
            fetchListeFournisseurs();
        }
    }, [reservation]);

    // 2bis. CHARGEMENT DU BON D'INTERVENTION (visibilité admin, lecture seule)
    useEffect(() => {
        const statutBrutInit = reservation?.statut || reservation?.status || '';
        if (!reservation || !['TERMINEE', 'VALIDEE'].includes(statutBrutInit)) {
            setBon(null);
            return;
        }
        let actif = true;
        setLoadingBon(true);
        getBonInterventionParReservation(reservation.id)
            .then(d => { if (actif && d.success) setBon(d.data); })
            .catch(() => { if (actif) setBon(null); })
            .finally(() => { if (actif) setLoadingBon(false); });
        return () => { actif = false; };
    }, [reservation]);

    if (!reservation) return null;

    // Helper pour générer le nom d'affichage d'un prestataire sans bug
    const getFournisseurName = (f) => {
        if (!f) return 'Prestataire inconnu';
        const nomComplet = [
            f.prenom || f.User?.prenom,
            f.nom || f.User?.nom || f.name
        ].filter(Boolean).join(' ');

        return f.nomEntreprise || f.nom_entreprise || nomComplet || f.email || `Prestataire #${f.id}`;
    };

    // 3. NORMALISATION DES DONNÉES
    const normalizeStatut = (raw) => {
        return String(raw || 'INCONNU')
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, '_');
    };

    const statutBrut = reservation.statut || reservation.status || 'INCONNU';
    const statut = normalizeStatut(statutBrut);
    const currentFournisseurId = reservation.fournisseurId || reservation.fournisseur_id || null;

    const prestataireSelectionne = fournisseurs.find(f => {
        const id = f.id ?? f.fournisseurId;
        return id !== undefined && id !== null && id.toString() === fournisseurId.toString();
    });

    // 4. GESTION DES APPELS API
    const handleAction = async (actionFn, ...args) => {
        setProcessing(true);
        try {
            await actionFn(...args);
            await onRefresh();
            onClose();
        } catch (e) {
            alert("Erreur lors de l'opération : " + (e.message || "Erreur réseau/serveur"));
        } finally {
            setProcessing(false);
        }
    };

    const handleAssignation = () => {
        if (!fournisseurId) {
            return alert("Veuillez sélectionner un prestataire dans la liste.");
        }
        handleAction(assignerFournisseur, reservation.id, parseInt(fournisseurId, 10), accordTelephone);
    };

    // Badge de statut — aligné sur la source unique constants/statuts.js,
    // avec des libellés adaptés au contexte administrateur.
    const getStatusBadge = () => {
        const meta = getStatutMeta(statut);
        const labelsAdmin = {
            EN_ATTENTE: "En attente d'assignation",
            ASSIGNEE: "Assignée — en attente d'acceptation du prestataire",
            EN_VALIDATION_ADMIN: "Prestataire OK — en attente du feu vert admin",
            ACCEPTEE: "Prête à démarrer",
            EN_PREPARATION: "Préparation matériel",
            EN_COURS: "Intervention en cours",
            TERMINEE: "Terminée — en attente de validation client",
            VALIDEE: "Clôturée & validée par le client",
            ANNULEE: "Annulée",
        };
        const label = labelsAdmin[statut] || meta.label || statutBrut;
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${meta.bg} ${meta.text} ${meta.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {label}
            </span>
        );
    };

    const afficherZoneAssignation = ['EN_ATTENTE', 'NOUVEAU', 'PENDING', 'INCONNU'].includes(statut) || !currentFournisseurId || modeReassignation;

    // Le feu vert n'a de sens QUE quand le prestataire a déjà accepté
    // (statut EN_VALIDATION_ADMIN). Avant fix, 'ASSIGNEE' déclenchait aussi
    // ce bloc, permettant à l'admin de démarrer une mission que le
    // prestataire n'avait même pas encore acceptée.
    const afficherFeuVert = ['EN_VALIDATION_ADMIN', 'EN_ATTENTE_VALIDATION'].includes(statut);

    const total = bon ? Number(bon.montantFinal ?? (Number(bon.montantMainOeuvre || 0) + Number(bon.montantPiecesOutils || 0))) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-[#0A0E17] border border-white/10 p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl relative my-8 text-slate-100 space-y-6">

                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition font-bold"
                >
                    ×
                </button>

                <div>
                    <div className="flex items-center justify-between flex-wrap gap-2 pr-8 mb-2">
                        <span className="text-[11px] font-extrabold tracking-widest text-purple-400 uppercase">Administration Kanari</span>
                        {getStatusBadge()}
                    </div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 flex-wrap">
                        <span>Dossier #{reservation.id}</span>
                        {Boolean(currentFournisseurId) && (
                            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                                Prestataire ID: #{currentFournisseurId}
                            </span>
                        )}
                    </h3>
                </div>

                {/* INFORMATIONS DU CLIENT & MISSION */}
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white/[0.03] p-3.5 rounded-2xl border border-white/5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                                <User size={13} className="text-purple-400" /> Client
                            </span>
                            <p className="text-white font-extrabold text-sm break-words">
                                {reservation.clientNom || reservation.client_nom || '—'}
                            </p>
                        </div>

                        <div className="bg-white/[0.03] p-3.5 rounded-2xl border border-white/5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                                <Phone size={13} className="text-emerald-400" /> Téléphone
                            </span>
                            <p className="text-white font-extrabold text-sm break-words">
                                {reservation.telephone || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white/[0.03] p-3.5 rounded-2xl border border-white/5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                            <MapPin size={13} className="text-rose-400" /> Lieu d'intervention
                        </span>
                        <p className="text-white font-medium text-xs sm:text-sm break-words">
                            {reservation.adresse || '—'}
                        </p>
                    </div>

                    <div className="bg-white/[0.03] p-3.5 rounded-2xl border border-white/5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1.5">
                            <Home size={13} className="text-blue-400" /> Besoin client
                        </span>
                        <p className="text-slate-200 font-medium text-xs sm:text-sm break-words whitespace-pre-line mt-1 bg-black/30 p-3 rounded-xl border border-white/5">
                            {reservation.besoin || reservation.description || '—'}
                        </p>
                    </div>
                </div>

                {/* BON D'INTERVENTION — visibilité admin dès que la mission est terminée ou validée */}
                {['TERMINEE', 'VALIDEE'].includes(statut) && (
                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-3">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                            <FileText size={13} className="text-amber-400" /> Bon d'intervention
                        </span>

                        {loadingBon && (
                            <p className="text-xs text-slate-500">Chargement du bon d'intervention...</p>
                        )}

                        {!loadingBon && !bon && (
                            <p className="text-xs text-rose-400">Aucun bon d'intervention trouvé pour cette mission — anomalie à vérifier.</p>
                        )}

                        {!loadingBon && bon && (
                            <div className="space-y-2 text-xs">
                                <p className="text-slate-200 whitespace-pre-line bg-black/30 p-3 rounded-xl border border-white/5">{bon.descriptionTravail}</p>
                                {bon.piecesOutils && (
                                    <p className="text-slate-400"><span className="text-slate-500">Pièces / matériel :</span> {bon.piecesOutils}</p>
                                )}
                                <div className="flex justify-between pt-2 border-t border-white/5">
                                    <span className="text-slate-400">Total facturé au client</span>
                                    <span className="font-black text-amber-400">{total.toLocaleString('fr-FR')} FCFA</span>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-slate-400">Validé par le client</span>
                                    <span className={`font-bold ${bon.valide ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {bon.valide ? 'Oui' : 'Pas encore'}
                                    </span>
                                </div>
                                {bon.valide && bon.note && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Note laissée par le client</span>
                                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                                            <Star size={12} className="fill-amber-400" /> {bon.note}/5
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ZONE D'ACTIONS ADMINISTRATIVES */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                            Actions Administratives
                        </span>

                        {Boolean(currentFournisseurId) && !modeReassignation && !['ANNULEE', 'TERMINEE', 'VALIDEE'].includes(statut) && (
                            <button
                                type="button"
                                onClick={() => setModeReassignation(true)}
                                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-bold"
                            >
                                Modifier le prestataire
                            </button>
                        )}
                    </div>

                    {/* 1. BLOC ASSIGNATION & SÉLECTION DU PRESTATAIRE */}
                    {afficherZoneAssignation && !['ANNULEE', 'TERMINEE', 'VALIDEE'].includes(statut) && (
                        <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl space-y-4 shadow-inner">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-amber-300 font-extrabold flex items-center gap-1.5">
                                    <Briefcase size={14} />
                                    {currentFournisseurId ? 'Réassigner à un autre prestataire :' : 'Choisir un prestataire dans la liste :'}
                                </label>
                                {modeReassignation && (
                                    <button onClick={() => setModeReassignation(false)} className="text-[10px] text-slate-400 hover:text-white">Annuler</button>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2.5">
                                <select
                                    value={fournisseurId}
                                    onChange={(e) => setFournisseurId(e.target.value)}
                                    disabled={loadingFournisseurs || processing}
                                    className="flex-1 bg-black/80 border border-amber-500/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 text-white font-bold cursor-pointer"
                                >
                                    <option value="">
                                        {loadingFournisseurs
                                            ? "Chargement des prestataires..."
                                            : fournisseurs.length === 0
                                                ? "Aucun prestataire trouvé"
                                                : "-- Sélectionner un prestataire --"
                                        }
                                    </option>
                                    {fournisseurs.map((f) => {
                                        const id = f.id ?? f.fournisseurId;
                                        if (!id) return null;

                                        const name = getFournisseurName(f);
                                        const spec = f.specialite || f.Service?.nom || 'Général';

                                        return (
                                            <option key={id} value={id} className="bg-slate-900 text-white py-1">
                                                #{id} - {name} ({spec})
                                            </option>
                                        );
                                    })}
                                </select>

                                <button
                                    onClick={handleAssignation}
                                    disabled={processing || !fournisseurId || loadingFournisseurs}
                                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    {processing ? <Loader2 className="animate-spin" size={16} /> : 'Assigner'}
                                </button>
                            </div>

                            {prestataireSelectionne && (
                                <div className="bg-black/50 border border-amber-500/30 p-3 rounded-xl text-xs space-y-1">
                                    <div className="flex justify-between items-center text-amber-300 font-bold">
                                        <span>{getFournisseurName(prestataireSelectionne)}</span>
                                        {Number(prestataireSelectionne.note) > 0 && (
                                            <span className="flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded text-[10px]">
                                                <Star size={10} className="fill-amber-400 text-amber-400" /> {prestataireSelectionne.note}/5
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-300 flex flex-wrap gap-x-4 gap-y-1 text-[11px] pt-1">
                                        <span>{prestataireSelectionne.telephone || prestataireSelectionne.User?.telephone || 'Non renseigné'}</span>
                                        <span>{prestataireSelectionne.specialite || 'Spécialité polyvalente'}</span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t border-amber-500/10">
                                <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none bg-black/40 p-3 rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition">
                                    <input
                                        type="checkbox"
                                        checked={accordTelephone}
                                        onChange={(e) => setAccordTelephone(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-amber-500/40 bg-black text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-500"
                                    />
                                    <div className="space-y-0.5">
                                        <span className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
                                            <PhoneCall size={13} /> Accord téléphonique direct obtenu
                                        </span>
                                        <p className="text-[11px] text-slate-400 leading-tight">
                                            En cochant ceci, la mission passe directement au statut "Prête à démarrer", sans attendre que le prestataire l'accepte sur son application.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* 2. BLOC FEU VERT — uniquement quand le prestataire a déjà accepté */}
                    {afficherFeuVert && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-3">
                            <p className="text-xs text-purple-200 font-medium flex items-center gap-2">
                                <Check size={16} className="text-purple-400 shrink-0" />
                                <span>Le prestataire a accepté la mission. Vous pouvez donner l'autorisation officielle de démarrer.</span>
                            </p>
                            <button
                                onClick={() => handleAction(autoriserDemarrage, reservation.id)}
                                disabled={processing}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 cursor-pointer"
                            >
                                {processing ? <Loader2 className="animate-spin" size={16} /> : "Accorder le feu vert d'intervention"}
                            </button>
                        </div>
                    )}

                    {/* 3. BOUTONS ANNULER & FERMER */}
                    <div className="flex gap-3 pt-2">
                        {!['ANNULEE', 'TERMINEE', 'VALIDEE'].includes(statut) && (
                            <button
                                type="button"
                                onClick={() => window.confirm("Voulez-vous vraiment annuler définitivement cette mission ?") && handleAction(updateReservationStatut, reservation.id, 'ANNULEE')}
                                disabled={processing}
                                className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-extrabold transition border border-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <ShieldAlert size={15} /> Annuler
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition text-slate-300 border border-white/5 cursor-pointer"
                        >
                            Fermer
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}