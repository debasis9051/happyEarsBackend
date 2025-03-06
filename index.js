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

        // const collectionRef = admin.firestore().collection('product_logs');

        // const docRef = collectionRef.doc();
        // docRef.set({
        //     added_by_user_name: 'Bhaswati Deb Bakshi',
        //     added_by_user_uid: 'Uyq4btP1RVWTDb1nTtdvrCzcs913',
        //     branch_id: 'fN4CFeQabs4gwCyPaZtd',
        //     created_at: new Date(),
        //     operation: 'invoiced',
        //     product_id: 'hOccVFOP24bdkvLJCGtB',
        //     product_name: 'KEY 188',
        //     reason: 'product invoiced',
        //     serial_number: '2466178730',
        // });


        return res.status(200).json({ operation: "success", message: "Script executed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
    }
});
