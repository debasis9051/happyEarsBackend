const express = require('express');
const productController = require('../controllers/productController');

const productRoutes = express.Router();

productRoutes.post('/add-product', productController.addProduct);

module.exports = productRoutes;