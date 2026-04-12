const express = require('express');
const dotenv = require('dotenv');
dotenv.config()
const cors = require('cors');
const checkJwt = require('./checkJwt');
const admin = require("./firebaseAdmin")
const fs = require('fs');
const moment = require('moment');

const app = express();
const port = process.env.port || 4001;

const frontendOrigins = process.env.frontend_origin.split(',');

app.use(cors({
    origin: frontendOrigins,
    methods: 'GET, POST',
    credentials: true
}));

app.use(express.json())
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    res.send('Hello from HappyEars backend');
});

app.listen(port, () => {
    console.log("Server is running on " + port);
});

app.use(require("./routes/userRoutes"))
app.use(require("./routes/productRoutes"))
app.use(require("./routes/invoiceRoutes"))
app.use(require("./routes/branchRoutes"))
app.use(require("./routes/salespersonRoutes"))
app.use(require("./routes/doctorRoutes"))
app.use(require("./routes/audiometryRoutes"))
app.use(require("./routes/patientRoutes"))
app.use(require("./routes/serviceRoutes"))

app.post('/custom-script', checkJwt(["admin_panel"]), async (req, res) => {
    try {
        console.log('custom script started by: ', req.body.current_user_name, req.body.current_user_uid)



        // Script: save product ids as an array in the invoice document seperately for easy querying later
        // const invoicesSnapshot = await admin.firestore().collection('invoices').get();
        // const batch = admin.firestore().batch();
        // invoicesSnapshot.forEach((doc) => {
        //     const invoiceData = doc.data();
        //     const productIds = invoiceData.line_items.map(item => item.product_id);
        //     const docRef = admin.firestore().collection('invoices').doc(doc.id);
        //     batch.update(docRef, { product_ids: productIds });
        // });
        // await batch.commit();
        // console.log('Script executed successfully: product_ids added to invoices');

        // await backupAllCollections();  

        return res.status(200).json({ operation: "success", message: "Script executed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
    }
});

async function backupAllCollections() {
    const db = admin.firestore();
    const collections = await db.listCollections();
    const backup = {};

    for (const col of collections) {
        const colName = col.id;
        console.log(`Backing up collection: ${colName}`);

        const snap = await col.get();
        backup[colName] = {};

        for (const doc of snap.docs) {
            backup[colName][doc.id] = doc.data();

            // Optionally fetch subcollections too
            const subcollections = await doc.ref.listCollections();
            if (subcollections.length > 0) {
                backup[colName][doc.id]._subcollections = {};

                for (const sub of subcollections) {
                    const subSnap = await sub.get();
                    backup[colName][doc.id]._subcollections[sub.id] = {};
                    for (const subDoc of subSnap.docs) {
                        backup[colName][doc.id]._subcollections[sub.id][subDoc.id] = subDoc.data();
                    }
                }
            }
        }
    }

    fs.writeFileSync(`firestore_backup_${moment().format("YYYYMMDD_HHmm")}.json` , JSON.stringify(backup, null, 2));
    console.log("✅ Backup complete → firestore_backup.json");
}
