const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors')
require('dotenv').config({path:".env"});

global.__basedir = __dirname;
//Middlewares
app.use(cors());
app.use(bodyParser.json());

//Import Routes
const nftRoute = require('./routes/nft')
const controller = require("./controller/file.controller");

app.use('/nft', nftRoute);
app.use('/upload', controller.upload);
app.use('/download', controller.download);

//ROUTES
app.get('/', (req, res) => {
    // res.send('We are on home');
});

app.listen(3000);