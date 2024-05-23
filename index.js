const express = require('express');
const dotenv = require('dotenv');
dotenv.config()
const cors = require('cors');
const checkJwt= require('./checkJwt');

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

app.post('/custom-script', checkJwt, async (req, res) => {
    try {
        console.log('custom script')

        /////////////////////////////////// Duplicate product and logs remove////////////////////////////
        // let qs1 = await admin.firestore().collection('products').orderBy("product_name").get()
        // let full_product_list = qs1.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        // let qs2 = await admin.firestore().collection('product_logs').orderBy("product_name").get()
        // let full_product_logs_list = qs2.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))

        // let t1 = full_product_list.map(x => x.serial_number) // full product list with dulicates
        // let t2 = Array.from(new Set(full_product_list.map(x => x.serial_number))) // full product list without duplicates
        // let t3 = t1.filter((x, i) => t1.indexOf(x) !== i)

        // console.log("duplicates", t3.length, t3)

        // const batch = admin.firestore().batch()
        // t3.forEach(x => {
        //     let dps = full_product_list.filter(y => y.serial_number === x)

        //     let delete_doc = dps.find(y => y.instock === true)
        //     console.log(dps.map(y => ({ id: y.id, product_name: y.product_name, serial_number: y.serial_number, instock: y.instock })), delete_doc.id)

        //     let delete_doc_logs = full_product_logs_list.filter(y=>y.product_id === delete_doc.id)
        //     console.log(delete_doc_logs)

        //     // const pdocRef = admin.firestore().collection('products').doc(delete_doc.id);
        //     // batch.delete(pdocRef)
            
        //     // delete_doc_logs.forEach(y=>{
        //     //     const pldocRef = admin.firestore().collection('product_logs').doc(y.id);
        //     //     batch.delete(pldocRef)
        //     // })
        // })
        // await batch.commit()



        //////////////////////////////////////Invoice number update/////////////////////////////////////
        // let qs1 = await admin.firestore().collection('invoices').orderBy("invoice_number").get()
        // let full_invoice_list = qs1.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))

        // let t1 = full_invoice_list.filter(x => !/(?:[^\/]*\/){4}[^\/]*/gm.test(x.invoice_number))

        // const batch = admin.firestore().batch()

        // t1.forEach(inv_doc => {
            
            // let new_inv_no = inv_doc.invoice_number.split("/")
            // new_inv_no.splice(1,0,moment.unix(inv_doc.date._seconds).format("YY"))
            // new_inv_no = new_inv_no.join("/")

            // console.log(inv_doc.invoice_number, new_inv_no)

            // const idocRef = admin.firestore().collection('invoices').doc(inv_doc.id);
            // batch.update(idocRef, { invoice_number: new_inv_no });
        // })

        // await batch.commit()
    
    
        

        return res.status(200).json({ operation: "success", message: "Script executed successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
    }
});
