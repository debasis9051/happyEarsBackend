const admin = require('firebase-admin');

class User {
    static async create() {
        console.log('creating user')
        // await admin.firestore().collection('users').doc(uid).set({
        //   email: email,
        //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // });
    }

    static async authenticate(uid) {
        console.log('authenticating')
        // const userSnapshot = await admin.firestore().collection('users').doc(uid).get();
        // return userSnapshot.data();
    }
}

module.exports = User;
