const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config()

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
