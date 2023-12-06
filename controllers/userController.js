const User = require('../models/userModel');
const { initializeApp } = require('firebase/app');
const { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut } = require('firebase/auth');
const admin = require('firebase-admin')
const serviceAccount = require("../happy-ears-service-config.json");

const firebaseConfig = {
    apiKey: "AIzaSyALdM0qeTdVC_5GDnBRE-l8RtT8vgXBpKM",
    authDomain: "happy-ears-31ddb.firebaseapp.com",
    projectId: "happy-ears-31ddb",
    storageBucket: "happy-ears-31ddb.appspot.com",
    messagingSenderId: "508939660758",
    appId: "1:508939660758:web:ceaa5ea247ebff95390877",
    measurementId: "G-QJQNSP26K0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
//const analytics = getAnalytics(app);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const userController = {
    signup: async (req, res) => {
        try {
            const credential = GoogleAuthProvider.credential(req.body.credential);
            signInWithCredential(auth, credential).then((val) => {
                console.log(val)
            }).catch((error) => {
                console.log(error)

                const errorCode = error.code;
                const errorMessage = error.message;
                const email = error.email;

                res.status(402).json({ operation: "failed", message: errorMessage });
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
    logout: async (req, res) => {
        try {
            signOut(auth).then(() => {
                console.log("user signed out")
                res.status(200).json({ operation: "success", message: "sign out success" });
            }).catch((error) => {
                console.log(error)

                res.status(402).json({ operation: "failed", message: "sign out failed" });
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
    getCurrentUser: async (req, res) => {
        try {
            console.log("current user: ",auth.currentUser)

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    const uid = user.uid;
                    console.log("user signed in", user, uid);
                } else {
                    console.log("user not signed in")
                }

                res.status(200).json({ operation: "success", message: "success", data: {user: user || null}});
            });

            
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    }
};

module.exports = userController;
