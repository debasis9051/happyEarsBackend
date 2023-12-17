const admin = require('firebase-admin')
const serviceAccount = require("./happy-ears-service-config.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin