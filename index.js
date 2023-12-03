const express = require('express');
const app = express();
const port = 3000;



var admin = require("firebase-admin");

var serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});




//const analytics = getAnalytics(app);

app.get('/', (req, res) => {
  res.send('Hello from HappyEars backend');
});

app.listen(port, () => {
  console.log("Server is running on http://localhost:" + port);
});
