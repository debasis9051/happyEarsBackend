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

        // return res.status(200).json({ operation: "success", message: "Script executed successfully" });

        // let q1 = await admin.firestore().collection('patients').get()
        // let full_patients_list = q1.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))

        // const patBatch = admin.firestore().batch()

        // full_patients_list = full_patients_list.sort((a,b)=>{
        //     return a.patient_number - b.patient_number
        // })

        // full_patients_list.forEach((doc) => {

        //     const numericPart = parseInt(doc.patient_number.replace("PAT", ""));
            
        //     const patDocRef = admin.firestore().collection('patients').doc(doc.id);
        //     patBatch.update(patDocRef, {
        //         patient_number: numericPart,
        //     });
        // })

        // await patBatch.commit()


        return res.status(200).json({ operation: "success", message: "Script executed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
    }
});
