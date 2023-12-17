const express = require('express');
const productController = require('../controllers/productController');

const productRoutes = express.Router();

productRoutes.post('/add-product', productController.addProduct);
productRoutes.post('/get-product-list', productController.getProductList);


module.exports = productRoutes;