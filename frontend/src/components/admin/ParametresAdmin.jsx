import React, { useEffect, useState } from 'react';
import { getSettings, updateSetting } from '../../util/api';

// Volontairement minimal : n'affiche QUE les paramètres qui pilotent une
// vraie logique dans le code (voir bonInterventionController.js et
// jobs/autoValiderBonsIntervention.js). Les autres catégories du cahier
// des charges (géolocalisation, urgence, horaires...) seront ajoutées ici
// au fur et à mesure qu'elles seront réellement implémentées côté serveur
// — pas avant, pour ne jamais afficher un réglage qui ne fait rien.

const LABELS_CATEGORIE = {
    commissions: 'Commissions',
    bons_intervention: "Bons d'intervention",
};

function LigneParametre({ param, onEnregistre }) {
    const [valeur, setValeur] = useState(param.valeur);
    const [motif, setMotif] = useState('');
    const [ouvert, setOuvert] = useState(false);
    const [loading, setLoading] = useState(false);
    const [erreur, setErreur] = useState('');

    const enregistrer = async () => {
        if (!motif.trim()) {
            setErreur('Un motif est obligatoire pour toute modification.');
            return;
        }
        setErreur('');
        setLoading(true);
        try {
            const d = await updateSetting(param.cle, { valeur, motif: motif.trim() });
            if (d.success) {
                onEnregistre(param.cle, valeur);
                setOuvert(false);
                setMotif('');
            } else {
                setErreur(d.message || 'Erreur lors de la mise à jour.');
            }
        } catch (err) {
            setErreur(err.message || 'Erreur de connexion au serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-white">{param.cle}</p>
                    {param.description && <p className="text-xs text-slate-500 mt-1">{param.description}</p>}
                </div>
                <div className="text-right shrink-0">
                    <p className="text-lg font-black text-purple-400">
                        {param.valeurTypee}{param.cle.includes('taux') ? ' %' : param.cle.includes('heures') ? ' h' : ''}
                    </p>
                </div>
            </div>

            {!ouvert ? (
                <button onClick={() => setOuvert(true)} className="text-xs font-bold text-purple-400 hover:text-purple-300">
                    Modifier
                </button>
            ) : (
                <div className="space-y-2 pt-2 border-t border-white/[0.05]">
                    {erreur && <p className="text-xs text-rose-400">{erreur}</p>}
                    <input
                        type={param.type === 'INTEGER' || param.type === 'DECIMAL' ? 'number' : 'text'}
                        value={valeur}
                        onChange={e => setValeur(e.target.value)}
                        className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 rounded-xl p-2.5 text-sm outline-none"
                    />
                    <textarea
                        rows={2}
                        placeholder="Motif de la modification (obligatoire, conservé dans l'historique)"
                        value={motif}
                        onChange={e => setMotif(e.target.value)}
                        className="w-full bg-[#090D16] border border-white/[0.08] focus:border-purple-500 text-slate-200 placeholder-slate-600 rounded-xl p-2.5 text-xs outline-none resize-none"
                    />
                    <div className="flex gap-2">
                        <button onClick={() => { setOuvert(false); setErreur(''); }} className="flex-1 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-xl text-xs font-bold transition-all">
                            Annuler
                        </button>
                        <button onClick={enregistrer} disabled={loading} className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                            {loading ? 'Enregistrement...' : 'Confirmer'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ParametresAdmin() {
    const [parCategorie, setParCategorie] = useState({});
    const [loading, setLoading] = useState(true);
    const [erreur, setErreur] = useState(null);

    const charger = async () => {
        setLoading(true);
        setErreur(null);
        try {
            const d = await getSettings();
            if (d.success) setParCategorie(d.data);
            else setErreur(d.message || 'Erreur lors du chargement.');
        } catch (err) {
            setErreur(err.message || 'Erreur de connexion au serveur.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { charger(); }, []);

    const handleEnregistre = (cle, nouvelleValeur) => {
        setParCategorie(prev => {
            const copie = { ...prev };
            for (const cat of Object.keys(copie)) {
                copie[cat] = copie[cat].map(p => p.cle === cle ? { ...p, valeur: nouvelleValeur, valeurTypee: nouvelleValeur } : p);
            }
            return copie;
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Chargement des paramètres...</p>
            </div>
        );
    }

    if (erreur) {
        return (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-rose-300 text-sm text-center">
                {erreur}
            </div>
        );
    }

    const categories = Object.keys(parCategorie);

    return (
        <div className="space-y-8">
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
                <p className="text-sm text-slate-300">
                    Cette page n'affiche que les paramètres qui pilotent réellement une logique en place dans l'application — la commission Kanari et le délai de validation automatique des bons d'intervention. D'autres catégories seront ajoutées au fur et à mesure qu'elles seront implémentées côté serveur.
                </p>
            </div>

            {categories.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">Aucun paramètre configuré pour le moment.</p>
            ) : categories.map(cat => (
                <div key={cat} className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{LABELS_CATEGORIE[cat] || cat}</h3>
                    <div className="space-y-3">
                        {parCategorie[cat].map(param => (
                            <LigneParametre key={param.cle} param={param} onEnregistre={handleEnregistre} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}