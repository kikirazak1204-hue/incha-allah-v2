// frontend/src/components/BonInterventionPrint.jsx
//
// Vue imprimable partagée pour :
//  - le bon d'intervention (côté client ET côté prestataire)
//  - le devis accepté (côté prestataire)
//
// Usage :
//   <BonInterventionPrint
//     ref={printRef}
//     type="bon"                 // "bon" | "devis"
//     numero={`BI-${mission.id}`}
//     mission={mission}
//     client={mission.client}
//     prestataire={mission.prestataire}
//     lignes={[
//       { label: "Main d'œuvre", montant: bon.montantMainOeuvre },
//       { label: bon.piecesOutils || 'Pièces / matériel', montant: bon.montantPiecesOutils },
//     ]}
//     description={bon.descriptionTravail}
//     dateDocument={bon.createdAt}
//   />
//
// Puis pour déclencher l'impression depuis le parent :
//   const handleImprimer = () => window.print();
// en isolant le rendu via la classe "print-area" (voir CSS ci-dessous),
// qui masque tout le reste de la page au moment de l'impression.

import React, { forwardRef } from 'react';

const BonInterventionPrint = forwardRef(function BonInterventionPrint(
    { type = 'bon', numero, mission = {}, client = {}, prestataire = {}, lignes = [], description = '', dateDocument },
    ref
) {
    const total = lignes.reduce((acc, l) => acc + Number(l.montant || 0), 0);
    const dateAffichee = dateDocument
        ? new Date(dateDocument).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <>
            {/* Styles d'impression : masque toute l'application sauf ce document */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }
                    @page { size: A4; margin: 16mm; }
                }
            `}</style>

            <div ref={ref} className="print-area bg-white text-slate-900 font-sans w-full max-w-[210mm] mx-auto p-10 hidden print:block">
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">KANARI SERVICE</h1>
                        <p className="text-xs text-slate-500 mt-1">Plateforme de gestion de prestations de services — Niamey, Niger</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-700">
                            {type === 'devis' ? 'Devis' : "Bon d'intervention"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">N° {numero}</p>
                        <p className="text-xs text-slate-500">Le {dateAffichee}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Client</p>
                        <p className="font-bold text-sm">{client?.nom || mission?.clientNom || '—'}</p>
                        <p className="text-xs text-slate-600">{client?.telephone || mission?.telephone || ''}</p>
                        <p className="text-xs text-slate-600">{mission?.adresseIntervention || mission?.adresse || ''}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Prestataire</p>
                        <p className="font-bold text-sm">{prestataire?.nomEntreprise || mission?.fournisseurNom || '—'}</p>
                        <p className="text-xs text-slate-600">{prestataire?.telephone || ''}</p>
                    </div>
                </div>

                <div className="mb-8">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">Mission</p>
                    <p className="text-sm">
                        Réf. #{mission?.id} — {mission?.serviceNom || mission?.service?.nom || 'Service'}
                    </p>
                </div>

                {description && (
                    <div className="mb-8">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">
                            {type === 'devis' ? 'Description de la prestation proposée' : 'Description des travaux effectués'}
                        </p>
                        <p className="text-sm leading-relaxed border border-slate-200 rounded-lg p-4 bg-slate-50">{description}</p>
                    </div>
                )}

                <table className="w-full text-sm mb-8 border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-900">
                            <th className="text-left py-2 font-bold uppercase text-xs tracking-wider">Désignation</th>
                            <th className="text-right py-2 font-bold uppercase text-xs tracking-wider">Montant (FCFA)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lignes.map((l, i) => (
                            <tr key={i} className="border-b border-slate-200">
                                <td className="py-2.5">{l.label}</td>
                                <td className="py-2.5 text-right font-mono">{Number(l.montant || 0).toLocaleString('fr-FR')}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="pt-4 font-black uppercase text-sm">Total</td>
                            <td className="pt-4 text-right font-black text-lg font-mono">{total.toLocaleString('fr-FR')} FCFA</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="grid grid-cols-2 gap-8 mt-16">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-10">Signature du prestataire</p>
                        <div className="border-t border-slate-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-10">
                            {type === 'devis' ? 'Signature du client (acceptation)' : 'Signature du client (validation)'}
                        </p>
                        <div className="border-t border-slate-400" />
                    </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-10 text-center">
                    Document généré par Kanari Service — ce document fait foi entre les deux parties pour la mission #{mission?.id}.
                </p>
            </div>
        </>
    );
});

export default BonInterventionPrint;