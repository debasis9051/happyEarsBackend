const express = require('express');
const dotenv = require('dotenv');
dotenv.config()
const cors = require('cors');
const checkJwt = require('./checkJwt');
const admin = require("./firebaseAdmin")

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

app.post('/custom-script', checkJwt(["admin_panel"]), async (req, res) => {
    try {
        console.log('custom script started by: ', req.body.current_user_name, req.body.current_user_uid)

        return res.status(200).json({ operation: "success", message: "Script executed successfully" });
        
        // let q1 = await admin.firestore().collection('invoices').get()
        // let full_invoice_list = q1.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))

        // let q2 = await admin.firestore().collection('patients').get()
        // let full_patients_list = q2.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        
        // let curr_pat_count = full_patients_list.length
        
        // let t1 = full_invoice_list.filter(x => !x.hasOwnProperty("patient_id"))
        

        // const patBatch = admin.firestore().batch()
        // const invBatch = admin.firestore().batch()

        // t1.forEach((doc) => {
        //     let tp = full_patients_list.find(x => x.patient_name.toLowerCase() === doc.patient_name.toLowerCase())

        //     let patid = ""
        //     if (tp) {
        //         //update patient details
        //         console.log("updating patient: ", tp.patient_name);

        //         const patDocRef = admin.firestore().collection('patients').doc(tp.id);
        //         patBatch.update(patDocRef, {
        //             contact_number: doc.contact_number,
        //             patient_address: doc.patient_address,
        //         });

        //         patid = tp.id
        //     }
        //     else {
        //         //add new patient details
        //         curr_pat_count += 1
        //         let new_pat_no = "PAT" + (curr_pat_count).toString().padStart(3, 0)

        //         console.log("adding patient: ", doc.patient_name, new_pat_no);

        //         const patDocRef = admin.firestore().collection('patients').doc();
        //         patBatch.set(patDocRef, {
        //             patient_name: doc.patient_name,
        //             contact_number: doc.contact_number,
        //             patient_number: new_pat_no,
        //             age: 0,
        //             sex: "others",
        //             patient_address: doc.patient_address,
        //             notes: "",
        //             map_coordinates: { latitude: "", longitude: "" },

        //             created_at: admin.firestore.FieldValue.serverTimestamp(),
        //             added_by_user_uid: req.body.current_user_uid,
        //             added_by_user_name: req.body.current_user_name,
        //         });

        //         patid = patDocRef.id
        //     }
            
        //     const docRef = admin.firestore().collection('invoices').doc(doc.id);
        //     invBatch.update(docRef, {
        //         contact_number: admin.firestore.FieldValue.delete(),
        //         patient_address: admin.firestore.FieldValue.delete(),
        //         patient_name: admin.firestore.FieldValue.delete(),

        //         patient_id: patid
        //     });
        // })

        // await patBatch.commit()
        // await invBatch.commit()




        return res.status(200).json({ operation: "success", message: "Script executed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
    }
});
