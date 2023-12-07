const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
dotenv.config()

console.log();

const port = process.env.port || 3001;

app.use(cors({
    origin: ['http://localhost:3000'],
    methods: 'GET, POST',
    credentials: true
}));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));

// app.use(admin)

app.get('/', (req, res) => {
    res.send('Hello from HappyEars backend');
});

app.listen(port, () => {
    console.log("Server is running on http://localhost:" + port);
});

app.use(require("./routes/userRoutes"))