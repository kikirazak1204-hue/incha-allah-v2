const admin = require('firebase-admin');

const sendNotification = async ({ token, topic, title, body, data }) => {
    try {
        const payload = {
            notification: { title, body },
            data: data || {}
        };

        if (token) payload.token = token;
        else if (topic) payload.topic = topic;
        else throw new Error("Un token ou un topic est requis.");

        // Sécurité : Si Firebase n'est pas encore initialisé avec tes clés sur Render,
        // on fait juste un log console pour empêcher le serveur de crasher.
        if (!admin.apps.length) {
            console.log('⚠️ [Mode Simulation] Firebase Admin non initialisé. Notif interceptée :', payload);
            return true;
        }

        const response = await admin.messaging().send(payload);
        console.log('✅ Notification FCM envoyée :', response);
        return response;
        
    } catch (error) {
        console.error('❌ Erreur d\'envoi de la notification FCM :', error);
        // On ne throw pas l'erreur pour ne pas bloquer la réservation si FCM échoue
        return false; 
    }
};

module.exports = { sendNotification };