const express = require('express');
const router = express.Router();

const mysql = require('mysql2');
const envfile = require('envfile');
const sourcePath = '.env'
require('dotenv').config({path:".env"});
const path = require('path')

const jwt = require('jsonwebtoken');
const config = require("../config/jwt.config");
const jwt_decode = require('jwt-decode');

const dbConfig = require('../config/nft_db_config');

const nodemailer = require('nodemailer');

const webLink = "https://www.theme.com.hk/"
// const webLink = "http://www.nft_place.com/";
// const webLink = 'http://localhost:3001/'

var ldap = require('ldapjs');

var client = ldap.createClient({url:'ldap://api.theme.com.hk:3000', reconnect: true});
// var client = ldap.createClient({url:'ldap://www.api_mongodb.com:3000', reconnect: true});
// var client = ldap.createClient({url:'ldap://localhost:3000', reconnect: true});

var db_config = {
    host: process.env.MYSQL_DB_HOST,
    user: process.env.MYSQL_DB_USER,
    password: process.env.MYSQL_DB_PW,
    database: process.env.NFT_DB_DB
}

var connect = mysql.createConnection(dbConfig);

let transporter = nodemailer.createTransport({
    host: '100.0.99.191',
    port: '25',
    auth:{
        user: "Info_theme",
        pass: "hfpassword"
    }
});

const SUCCESS_RES = {
    statusCode: 200,
    header: {
        "Access-Control-Allow-Header": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
    },
    body: {
        message: 'SUCCESS'
    }
}

const INVALID_TOKEN_RES = {
    statusCode: 401,
    header: {
        "Access-Control-Allow-Header": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
    },
    body: {
        message: `INVALID TOKEN`
    }
}

const INVALID_REQUEST_RES = {
    statusCode: 401,
    header: {
        "Access-Control-Allow-Header": "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
    },
    body: {
        message: 'INVALID REQUEST'
    }
}

process.on('uncaughtException', function(err){
    if(err){
        console.log(err.stack);
        console.log('NOT exit...');
        console.log('\n\t *** Cannot establish a connection with the database. ***')
        connect = reconnect(connect);
    }else{
        console.log("\n\t *** New connection established with the database. ***");
    }
});

function reconnect(connect){
    // console.log(connect);
    console.log("\n New connection tentative...");
    //- Destroy the current connection variable
    if(connect !== undefined) connect.destroy();
    //- Create a new one
    connect = mysql.createConnection(db_config);
    //- Try to reconnect
    connect.connect(function(err){
        if(err) {
            //- Try to connect every 2 seconds.
            setTimeout(reconnect, 2000);
        }else {
            console.log("\n\t *** New connection established with the database. ***")
            return connect;
        }
    });
}

client.on('error', function(err){
    console.log(err);
    client.unbind();
    client.destroy();
})

router.get('/getAvaliableNFT', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);
    
    var sql = "SELECT nft_id FROM NFT WHERE Status = 'Online' AND User_Id IS NULL"

    connect.query(sql, (err, result) => {
        if(err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        if (result.length > 0){
            let data = JSON.parse(JSON.stringify(result));
            var response = {
                statusCode: 200,
                avaliable: true,
                result: data
            }
            res.json(response);
            connect.destroy();
        }
        else{
            var response = {
                statusCode: 200,
                avaliable: false
            }
        }

        

    });

});

router.post('/getAllnft', async ( req, res ) => {

    var connect = mysql.createConnection(dbConfig);

    try{
        var user_id = 0;

        if(req.body.params.token === null){
            var user_id = null;
        }
        else{
            try{
                const decode = jwt.verify(req.body.params.token, config.jwt.secret, {
                    algorithm: "HS256",
                });
                var user_id = decode.user_id;
            }catch (err){
                res.json(INVALID_TOKEN_RES);
                return
            }
        }

        var sql = `SELECT n.nft_id, n.ImageSrc, n.Status, DATE_FORMAT(n.UploadDate, '%d/%m/%Y') UploadDate, n.User_Id, u.LastName, u.FirstName, IF(L.User_id IS NOT NULL, 1, 0) liked, t.token_code, DATE_FORMAT(tu.DateTime, '%d/%m/%Y') tu, C.likes FROM NFT n LEFT JOIN User u on u.User_Id = n.User_Id LEFT JOIN (SELECT * FROM NFT_Store.Like WHERE NFT_Store.Like.User_id = ${user_id}) L on L.nft_id = n.nft_id LEFT JOIN token t on t.nft_id = n.nft_id LEFT JOIN Token_User tu on tu.Token_id = t.token_id LEFT JOIN (SELECT L.nft_id, COUNT(nft_id) as likes FROM NFT_Store.Like L GROUP BY L.nft_id) C on C.nft_id = n.nft_id;`;
        
        connect.query(sql, (err, result) => {
            if(err){
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: result
                }
            }

            res.json(response);
            connect.destroy();

        });

    }catch(err){
        console.info(err);
        res.json(err);
    }

})

router.post('/forget', async ( req, res ) => {

    var connect = mysql.createConnection(dbConfig);

    if (!req.body.params.email){
        console.log('[INVALID REQUEST] - ', req.body);
        res.json(INVALID_REQUEST_RES);
    }
    
    var search_sql = "SELECT * FROM User WHERE EmailAddress = '" + req.body.params.email +"';";

    connect.query(search_sql, (err, result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
        }

        if (result.length > 0){
            const payload = {
                ac: result[0].EmailAddress
            }

            const token = jwt.sign(payload, config.jwt.secret, config.jwt.options);
            const link_with_token = webLink + `collection/forget/${token}`

            message = {
                from: "info@theme.com.hk",
                to: req.body.params.email,
                subject: "Reset your password",
                html: `<!doctype html>
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                        <title>Simple Transactional Email</title>
                        <style>
                            body {
                                background-color: #f6f6f6;
                                width: 100%; 
                                max-width: 800px;
                                margin: auto;
                            }
                
                            .center {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                            }
                
                            .backgound {
                                padding: 10px;
                                background-color: #7D75FE;
                                border-radius: 3px;
                                text-align: center;
                            }
                
                            .backgound:hover{
                                cursor: pointer;
                            }
                
                            span{
                                color: #f6f6f6;
                            }
                
                            a{
                                text-decoration: none;
                            }
                
                        </style>
                    </head>
                    <body>
                        <div style="width: '100%';"><img src='cid:logo' style="width: '100%';" /></div>
                        <h3>Reset your password</h3>
                        <p>Follow this link to reset your account password at THEME. If you didn't request a new password, you can safely delete this email.<br></p>
                        <a href="${link_with_token}">
                            <div class="center">
                                <div class="backgound">
                                    <span>Reset your password</span>
                                </div>
                            </div>
                        </a>
                        
                        <p>If you have any questions, reply to this email or contact us at info@theme.com</p>
                            
                    </body>`,
                    attachments: [{
                        filename:'Email_Heading.png',
                        path: path.join(__dirname, '../') + '/resources/static/assets/Email_Heading.png',
                        cid:'logo'
                    }]
        
            };

            transporter.sendMail(message, function(err, info) {
                if (err){
                    console.log(err);
                }else{
                    console.log(info);

                }
            });

            res.json(SUCCESS_RES);
            connect.destroy();

        }

    })


});

router.put('/setPassword', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    try{
        const decode = jwt.verify(req.body.params.token, config.jwt.secret, config.jwt.options);
        const email = decode.ac;
        const password = req.body.params.password;

        var search_sql = `SELECT User.User_id FROM User WHERE User.EmailAddress = '${email}'`

        connect.query(search_sql, (err, result)=>{

            if (err) {
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
            }

            if (result.length > 0){

                const user_id = result[0].User_id;

                var update_sql = `UPDATE User SET Password = '${password}' WHERE User.User_id = '${user_id}';`;

                connect.query(update_sql, (err, result) => {
                    if (err) {
                        console.log('[UPDATE ERROR] - ', err.message);
                        res.json(err);
                    }

                    res.json(SUCCESS_RES);
                    connect.destroy();

                })
            }
            else{
                const response = {
                    statusCode: 401,
                    header: {
                        "Access-Control-Allow-Header": "Content-Type",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                    },
                    body: {
                        'message': 'User Not Found'
                    }
                }
                res.json(response);
                connect.destroy();
            }

        })
    }catch(err){
        console.log('[TOKEN ERROR] - ', err)
        res.json(INVALID_TOKEN_RES);
    }


})

router.get('/getNFTFromToken', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var search_sql = 'SELECT T.nft_id, T.token_code, T.token_id, n.ImageSrc, tu.User_id FROM token T LEFT JOIN NFT n on n.nft_id = T.nft_id LEFT JOIN Token_User tu on tu.token_id = T.token_id WHERE T.token_code = "'+ req.query.tokenCode + '";'

    connect.query(search_sql, (err, result) => {
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        if(result.length > 0){
            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: result[0]
                }
            }
            res.json(response);
            connect.destroy();
        }else{
            const response = {
                statusCode: 401,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    'message': 'Token Error'
                }
            }
            res.json(response);
            connect.destroy();
        }
    })
})


router.get('/getProduct', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var select_sql = 'SELECT p.Product_id, p.ProductName, p.Price, p.Price_Remark, p.Color, p.html_code, I.link FROM Product p LEFT JOIN Product_Img I on p.Product_id = I.Product_id Where p.ProductName = "' + req.query.product + '";'

    connect.query(select_sql, (err, result) => {
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        if(result.length > 0){
            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: result
                }
            }
            res.json(response);
            connect.destroy();

        }else{
            const response = {
                statusCode: 401,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    'message': 'Not Found'
                }
            }
            res.json(response);
            connect.destroy();
        }

    })


});

router.get('/getownnft', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    try{

        const decode = jwt_decode(req.query.token);

        var select_sql =`SELECT a.User_id, a.EmailAddress, a.FirstName, a.LastName, a.nft_id, a.nftName, a.ImageSrc, a.Order_ID, a.DisableOrder, t.DateTime Share_Date, t.From_User_id, t.To_User_id, t.Acceptance, t.Accept_Date FROM 
        (SELECT u.User_id, u.EmailAddress, u.FirstName, u.LastName, n.nft_id, n.nftName, n.ImageSrc, o.Order_Id, tk.DisableOrder FROM User u LEFT JOIN NFT n on n.User_Id = u.User_id 
        LEFT JOIN NFT_Store.Order o on o.nft_id = n.nft_id
        LEFT JOIN NFT_Store.token tk on tk.nft_id = n.nft_id) a 
        LEFT JOIN (SELECT * FROM NFT_Store.Transfer WHERE From_User_id <> 0 ORDER BY transferID desc LIMIT 1 ) t  on t.nft_id = a.nft_id
        WHERE a.EmailAddress = "${decode.ac}"`;

        // var select_sql = `SELECT u.User_id, u.EmailAddress, u.FirstName, u.LastName, n.nft_id, n.nftName, n.ImageSrc, o.Order_Id, tk.DisableOrder FROM User u 
        //                     LEFT JOIN NFT n on n.User_Id = u.User_id 
        //                     LEFT JOIN NFT_Store.Order o on o.nft_id = n.nft_id
        //                     LEFT JOIN NFT_Store.token tk on tk.nft_id = n.nft_id
        //                     WHERE u.EmailAddress = "${decode.ac}"`;
        
        connect.query(select_sql, (err, result) =>{

            if (err){
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            if(result.length > 0){

                console.log(result);
                const response = {
                    statusCode: 200,
                    header: {
                        "Access-Control-Allow-Header": "Content-Type",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                    },
                    body: {
                        data: result
                    }

                    
                }
                res.json(response);
                connect.destroy();
            }else{
                const response = {
                    statusCode: 401,
                    header: {
                        "Access-Control-Allow-Header": "Content-Type",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                    },
                    body: {
                        'message': 'Please Login again'
                    }
                }
                res.json(response);
                connect.destroy();
            }
            
            

        });

    }catch(err){
        console.log('[TOKEN ERROR] - ', err)
        res.json(INVALID_TOKEN_RES);

    }


})

router.get('/orderRecord', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    const decode = jwt_decode(req.query.token);

    var select_sql = 'SELECT o.Order_Id, u.LastName, u.FirstName, u.EmailAddress, u.Address, p.ProductName, p.Color, p.Price, p.Price_Remark, o.nft_id, o.Size, o.quantity FROM NFT_Store.Order o LEFT JOIN User u on o.UserID = u.User_id LEFT JOIN Product p on o.ProductID = p.Product_id WHERE o.Order_Id = "' + req.query.order_id + '" AND u.EmailAddress = "' + decode.ac + '"';

    connect.query(select_sql, (err, result) => {

        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        if(result.length > 0){
            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: result
                }
            }
            res.json(response);
            connect.destroy();
        }else{
            const response = {
                statusCode: 401,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    'message': 'Not Found'
                }
            }
            res.json(response);
            connect.destroy();
        }

    })


})

router.get('/order', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var select_sql = "SELECT o.Order_Id, t.DisableOrder FROM NFT_Store.token t LEFT JOIN NFT_Store.Order o on t.nft_id = o.nft_id WHERE t.nft_id = '"+ req.query.nft_id + "'";

    connect.query(select_sql, async (err, select_result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        
        if(select_result.length < 1){
            
            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: {
                        Order: null,
                        DisableOrder: select_result[0].DisableOrder,
                        message: 'SUCCESS'
                    }
                }
            }
            res.json(response);
            connect.destroy();

        }else{
            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: {
                        Order: select_result[0].Order_Id,
                        DisableOrder: select_result[0].DisableOrder,
                        message: 'SUCCESS'
                    }
                }
            }
            res.json(response);
            connect.destroy();
        }

    });



})

router.put('/setContact', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var update_sql = 'UPDATE User SET Address = "'+ req.query.Address +'", TelNumber = '+ req.query.TelNum +' WHERE User_id = ' +req.query.UserId +';'

    connect.query(update_sql, (err, result) => {
        if (err){
            console.log('[INSERT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        res.json({
            statusCode: 200
        });
        connect.destroy();
    })


})

router.put('/registerNFT', async (req, res) =>{

    var connect = mysql.createConnection(dbConfig);

    try{
        const decode = jwt.verify(req.body.params.secretToken, config.jwt.secret, {
            algorithm: "HS256",
            expiresIn: "1d",
          });
        const email = decode.ac;

        var search_sql = `SELECT User.User_id FROM User WHERE User.EmailAddress = '${email}'`

        connect.query(search_sql, (err, result)=>{
            if (err) {
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
            }

            if (result.length>0){
                const user_id = result[0].User_id;

                var update_sql = `UPDATE NFT SET User_Id = '${user_id}' WHERE NFT.nft_id = '${req.body.params.nft_id}';`;

                connect.query(update_sql, (err, result)=>{
                    if (err) {
                        console.log('[UPDATE ERROR] - ', err.message);
                        res.json(err);
                    }

                    let date_ob = new Date();

                    // current date
                    // adjust 0 before single digit date
                    let date = ("0" + date_ob.getDate()).slice(-2);

                    // current month
                    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

                    // current year
                    let year = date_ob.getFullYear();

                    // current hours
                    let hours = date_ob.getHours();

                    // current minutes
                    let minutes = date_ob.getMinutes();

                    // current seconds
                    let seconds = date_ob.getSeconds();

                    // prints date & time in YYYY-MM-DD HH:MM:SS format
                    let datetime = year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;

                    var insert_sql = "INSERT INTO NFT_Store.Transfer ( DateTime, From_User_id, To_User_id, nft_id ) VALUES ('" + datetime + "', '" + '0' + "', '" + user_id + "', '" + req.body.params.nft_id + "');" ;

                    connect.query(insert_sql, (err, result)=>{
                        if (err) {
                            console.log('[INSERT ERROR] - ', err.message);
                            res.json(err);
                        }
                        
                        res.json(SUCCESS_RES);
                        connect.destroy();
                    });
                });
            }
            else{
                const response = {
                    statusCode: 401,
                    header: {
                        "Access-Control-Allow-Header": "Content-Type",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                    },
                    body: {
                        'message': 'User Not Found'
                    }
                }
                res.json(response);
                connect.destroy();
            }
        })
    }catch(err){
        console.log('[TOKEN ERROR] - ', err)
        res.json(INVALID_TOKEN_RES);
    }


})

router.get('/getUserName/:token', async (req, res)=> {

    var connect = mysql.createConnection(dbConfig);

    try{
        if(!req.params['token']){
            res.json(INVALID_REQUEST_RES);
            return;
        }
        const decode = jwt.verify(req.params['token'], config.jwt.secret, {
            algorithm: "HS256",
            expiresIn: "1d",
          });
        var user_id = decode.user_id;
    }catch(err){
        res.json(INVALID_TOKEN_RES);
        return;
    }
    
    var search_sql = `SELECT FirstName, LastName FROM NFT_Store.User WHERE User_id = ${user_id};`;

    connect.query(search_sql, (err, result)=>{
        if(err) {
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
        }
        if(result.length > 0){
            res.json(result[0]);
            connect.destroy();
        }
    })


})

router.post('/login', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var login_sql = "SELECT * FROM User WHERE EmailAddress = '" + req.body.email +"' AND Password = '" + req.body.password + "' AND Active = 1;"

    connect.query(login_sql, (err, result) => {
        if(err) {
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
        }

        if(result.length > 0){
            const payload = {
                ac: result[0].EmailAddress,
                user_id: result[0].User_id
            }

            // const token = jwt.sign(payload, config.jwt.secret, config.jwt.options);
            const token = jwt.sign(payload, config.jwt.secret, {
                algorithm: "HS256",
              });

            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    token: token
                }
            }

            res.json(response);
            connect.destroy();
            
        }else{

            const response = {
                statusCode: 401,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    'message': 'Your authentication information is incorrect. Please try again.'
                }
            }

            res.json(response);
            connect.destroy();

        }
    })



})


router.post('/register', async (req, res) =>{

    var connect = mysql.createConnection(dbConfig);

    if (!req.body.values.email || !req.body.values.firstname || !req.body.values.lastname || !req.body.values.password){
        res.json(INVALID_REQUEST_RES);
        return;
    }

    var search_sql = `SELECT * FROM NFT_Store.User WHERE EmailAddress = "${req.body.values.email}";`;

    connect.query(search_sql, (err, result) => {
        if (err){
            console.log('[SEARCH ERROR] - ', err.message);
            res.json(err);
            return;
        }
        if (result.length > 0){
            const response = {
                statusCode: 400,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: {
                        message: 'Email Used'
                    }
                }
            }
            res.json(response);
            
            return;
        }
        var insert_sql = "INSERT INTO NFT_Store.User ( FirstName, LastName, EmailAddress, Password, Subscibed ) VALUES ('" + req.body.values.firstname + "', '" + req.body.values.lastname + "', '" + req.body.values.email + "', '" + req.body.values.password + "', '" + (req.body.values.subscibed? 1:0) + "');" ;
        connect.query(insert_sql, (err, result) => {
            if (err){
                console.log('[INSERT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            var search_sql = `SELECT token_id FROM NFT_Store.token T WHERE T.token_id NOT IN (SELECT token_id FROM Token_User) AND T.Reserved = 0;`
            connect.query(search_sql, (err, result) =>{
                if (err){
                    console.log('[SELECT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }

                const list = result;
                
                const randNum = Math.floor(Math.random() * list.length);
                var search_sql = `SELECT token_code FROM token T WHERE T.token_id = ${randNum};`;
                connect.query(search_sql, (err, result)=>{
                    if (err){
                        console.log('[SELECT ERROR] - ', err.message);
                        res.json(err);
                        return;
                    }

                    // const nft_token = result[0].token_code;

                    const payload = {
                        email: req.body.values.email
                    }
        
                    const verify_token = jwt.sign(payload, config.jwt.secret, {
                        algorithm: "HS256",
                      });

                    message = {
                        from: "info@theme.com.hk",
                        to: req.body.values.email,
                        subject: "Confirm your email address",
                        html: `<!doctype html>
                        <html>
                            <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                                <title>Simple Transactional Email</title>
                                <style>
                                    body {
                                        background-color: #f6f6f6;
                                        width: 100%; 
                                        max-width: 800px;
                                        margin: auto;
                                    }
                        
                                    .center {
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                    }
                        
                                    .backgound {
                                        padding: 10px;
                                        background-color: #7D75FE;
                                        border-radius: 3px;
                                    }
                        
                                    .backgound:hover{
                                        cursor: pointer;
                                    }
                        
                                    span{
                                        color: #f6f6f6;
                                    }

                                    a{
                                        text-decoration: none;
                                    }
                        
                                </style>
                            </head>
                            <body>
                                <div style="width: '100%';"><img src='cid:logo' style="width: '100%';" /></div>
                                <h3>Welcome to THEME!</h3>
                                <p>You've successfully activated your THEME account. Please go to www.theme.com and log-in with your email address and password.<br>Find your token code below.<br></p>
                                <a href="${webLink+'collection/verify/'+verify_token}">
                                    <div class="center">
                                        <div class="backgound">
                                            <span>Confirm your Email</span>
                                        </div>
                                    </div>
                                </a>
                                <p>If you have any questions, reply to this email or contact us at info@theme.com</p>
                                    
                            </body>`,
                            attachments: [{
                                filename:'Email_Heading.png',
                                path: path.join(__dirname, '../') + '/resources/static/assets/Email_Heading.png',
                                cid:'logo'
                            }]                

                    };

                    transporter.sendMail(message, function(err, info) {
                        if (err){
                            console.log(err);
                        }else{
                            console.log(info);
                        }
                    });

                    res.json(SUCCESS_RES);
                    connect.destroy();
                })
            })
        });
    })
    
})

router.put('/verify', async (req, res)=>{

    var connect = mysql.createConnection(dbConfig);

    try{    
        if(!req.body.params.verifyToken){
            res.json(INVALID_REQUEST_RES);
            return;
        }
        const verify_token = jwt.verify(req.body.params.verifyToken, config.jwt.secret, {
            algorithm: "HS256",
          });
        var email = verify_token.email;
    }catch(err){
        res.json(INVALID_TOKEN_RES);
        return;
    }

    var search_sql = `SELECT * FROM NFT_Store.User WHERE EmailAddress = "${email}";`
    connect.query(search_sql, (err, result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        if (result.length > 0){
            const user_id = result[0].User_id;
            
            var update_sql = `UPDATE NFT_Store.User SET Active = 1 WHERE User_id = ${user_id};`
            connect.query(update_sql, (err, result)=>{
                if (err){
                    console.log('[UPDATE ERROR] - ', err.message);
                    res.json(err);
                    return;
                }
                res.json(SUCCESS_RES);
                connect.destroy();
            })
        }
        else{
            res.json(INVALID_TOKEN_RES);
        }
    })


})


router.post('/order', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    const decode = jwt_decode(req.body.params.token);

    var select_sql = 'SELECT User_Id, FirstName, LastName From User Where EmailAddress = "' + decode.ac + '"';

    connect.query(select_sql, (err, result) => {

        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        var string = JSON.stringify(result);
        var data = JSON.parse(string);
        var userid = data[0].User_Id;
        var firstname = data[0].FirstName;
        var lastname = data[0].LastName;

        var color_sql = 'SELECT Product_Id, Price, Price_Remark FROM Product WHERE Color = "' + req.body.params.color + '"';

        connect.query(color_sql, (err, result) =>{

            if (err){
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            
            var color_result = JSON.stringify(result);
            var color_data = JSON.parse(color_result);
            var productid = color_data[0].Product_Id;
            var price = color_data[0].Price;
            var priceRemark = color_data[0].Price_Remark;

            var select_sql = "SELECT Order_Id FROM NFT_Store.Order WHERE nft_id = '"+ req.body.params.nft_id + "'";

            connect.query(select_sql, async (err, select_result)=>{
                if (err){
                    console.log('[SELECT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }
                
                if(select_result.length < 1){
                    
                    var insert_sql = "INSERT INTO NFT_Store.Order (UserID, nft_id, ProductID, Size, quantity, Remark) VALUES ('" + userid + "', '" + req.body.params.nft_id + "', '" + productid + "', '" + req.body.params.size + "', '1', '" + req.body.params.remark + "')"

                    connect.query(insert_sql, async (err, insert_result) => {

                        if (err){
                            console.log('[INSERT ERROR] - ', err.message);
                            res.json(err);
                            return;
                        }

                        // console.log(insert_result);

                        const id_char_length = 6;
                        var display_id = '#';

                        for (let x = 1; x < id_char_length - req.body.params.nft_id.toString().length; x++ ){
                            display_id = display_id + '0';
                        }

                        display_id = display_id + req.body.params.nft_id.toString();


                        const payload = {
                            email: decode.ac
                        }
                    
                        const verify_token = jwt.sign(payload, config.jwt.secret, {
                            algorithm: "HS256",
                          });
                    
                        message = {
                            from: "info@theme.com.hk",
                            to: decode.ac,
                            subject: "Confirm your email address",
                            html: `<!doctype html>
                            <html>
                                <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                                    <title>Simple Transactional Email</title>
                                    <style>
                                        body {
                                            background-color: #f6f6f6;
                                            width: 100%; 
                                            max-width: 800px;
                                            margin: auto;
                                        }
                            
                                        .center {
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                        }
                            
                                        .backgound {
                                            padding: 10px;
                                            background-color: #7D75FE;
                                            border-radius: 3px;
                                        }
                            
                                        .backgound:hover{
                                            cursor: pointer;
                                        }
                            
                                        span{
                                            color: #f6f6f6;
                                        }
                    
                                        a{
                                            text-decoration: none;
                                        }
                            
                                    </style>
                                </head>
                                <body>
                                    <div style="width: '100%';"><img src='cid:logo' style="width: '100%';" /></div>
                                    <div class="row d-flex justify-content-center position-relative mt-3 mb-3">
                                    <div class="w-25 d-flex justify-content-center">
                                    Transferring You to <a href="https://www.silkism.com/products/test-generative-art-hoodies" style="text-decoration-color: rgb(249, 160, 27);">www.silkism.com</a> to proceed checkout</div><div class="row">
                                    <div class="col fs-2"><b>Order No. ${insert_result.insertId}</b></div></div>
                                    <div class="row"><div class="col text-dark">Name: ${firstname} ${lastname}</div></div>
                                    <div class="row"><div class="col text-dark">Email: ${decode.ac}</div></div>
                                    <div class="row"><div class="col text-dark">Item: Theme x Silkism - Hoodie</div></div>
                                    <div class="row"><div class="col text-dark">Artwork ID: ${display_id}</div></div>
                                    <div class="row"><div class="col text-dark">Colour: ${req.body.params.color}</div></div>
                                    <div class="row"><div class="col text-dark">Size: ${req.body.params.size}</div></div>
                                    <div class="row"><div class="col text-dark">Price: HKD$ ${price} ${priceRemark}</div></div>
                                    <div class="color-F91B fs-5">please <a href="https://www.silkism.com/products/test-generative-art-hoodies" class="color-7DFE" style="text-decoration-color: rgb(125, 117, 254);">click here</a> if the page does not lead you to the checkout page.</div></p>
                                    <p>If you have any questions, reply to this email or contact us at info@theme.com</p>
                                    <a href="https://www.silkism.com/products/test-generative-art-hoodies">
                                        <div class="center">
                                            <div class="backgound" >
                                                <span>Proceed Checkout</span>
                                            </div>
                                        </div>
                                    </a>
                                </body>`,
                                attachments: [{
                                    filename:'Email_Heading.png',
                                    path: path.join(__dirname, '../') + '/resources/static/assets/Email_Heading.png',
                                    cid:'logo'
                                }]
                    
                        };
                    
                        transporter.sendMail(message, function(err, info) {
                            if (err){
                                console.log(err);
                            }else{
                                console.log(info);
                            }
                        });

                        const response = {
                            statusCode: 200,
                            header: {
                                "Access-Control-Allow-Header": "Content-Type",
                                "Access-Control-Allow-Origin": "*",
                                "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                            },
                            body: {
                                data: {
                                    Order: insert_result.insertId,
                                    message: 'SUCCESS'
                                }
                            }
                        }
                        res.json(response);
                        connect.destroy();

                    });
                }else{
                    const response = {
                        statusCode: 200,
                        header: {
                            "Access-Control-Allow-Header": "Content-Type",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                        },
                        body: {
                            data: {
                                Order: select_result[0].Order_Id,
                                message: 'SUCCESS'
                            }
                        }
                    }
                    res.json(response);
                }

            });
        });
    })


})

router.post('/registerToken', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    const decode = jwt_decode(req.body.params.secretToken);

    var select_sql = 'SELECT User_Id From User Where EmailAddress = "' + decode.ac + '"';

    connect.query(select_sql, (err, result) => {

        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        var string = JSON.stringify(result);
        var data = JSON.parse(string);
        var userid = data[0].User_Id;

        var Token_sql = 'SELECT token_Id From token Where token_code = "' + req.body.params.tokenCode + '"';

        connect.query(Token_sql, (err, token_result) => {

            if (err){
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
                return;
            }
    
            var token_string = JSON.stringify(token_result);
            var token_data = JSON.parse(token_string);
            var tokenid = token_data[0].token_Id;

            let date_ob = new Date();

            // current date
            // adjust 0 before single digit date
            let date = ("0" + date_ob.getDate()).slice(-2);

            // current month
            let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

            // current year
            let year = date_ob.getFullYear();

            // current hours
            let hours = date_ob.getHours();

            // current minutes
            let minutes = date_ob.getMinutes();

            // current seconds
            let seconds = date_ob.getSeconds();

            // prints date & time in YYYY-MM-DD HH:MM:SS format
            let datetime = year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;
    
            var insert_sql = "INSERT INTO NFT_Store.Token_User (Token_id, User_id, DateTime )  VALUES ('" + tokenid + "', '" + userid + "', '" + datetime + "')";
    
            connect.query(insert_sql, async (err, insert_result) => {

                if (err){
                    console.log('[INSERT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }

                res.json(SUCCESS_RES);
                connect.destroy();

            });
            
        })  
    })

})

router.post('/token', async (req, res) => {
    
    var connect = mysql.createConnection(dbConfig);

    var insert_sql = "INSERT INTO token SET ?";

    connect.query(insert_sql, req.body, function (err, result){
        if(err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        const response = {
            statusCode: 200,
            header: {
                "Access-Control-Allow-Header": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
            },
            body: "SUCCESS"
        }

        res.json(response);
        connect.destroy();

    });



});

router.post('/insertdb', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);
    
    var insertdb_sql = "INSERT INTO NFT_Store.NFT ( nftName, Type, ImageSrc ) VALUES ('" + req.body.params.nftName + "', '" + req.body.params.Type + "', '" + req.body.params.ImageSrc + "')";

    connect.query(insertdb_sql, (err, result) => {
        if(err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        res.json(SUCCESS_RES);
        connect.destroy();

    });

    

});

router.put('/updatedb', async (req, res) =>{

    var connect = mysql.createConnection(dbConfig);

    // var alter_sql = "UPDATE token SET nft_id = '" + req.body.param + "' WHERE token_id = '"+ req.body.param + "';"
    var alter_sql = "UPDATE NFT set UploadDate = '2022-11-15' WHERE nft_id = '"  + req.body.params.id + "';"

    connect.query(alter_sql, (err, result) => {
        if(err){
            console.log('[UPDATE ERROR] - ', err.message);
            res.json(err);
            return;
        }
        
        const response = {
            statusCode: 200
        }

        res.json(response);
        connect.destroy();
    })

    

})

router.get('/getNFTtoken', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    try{
        var search_sql = "SELECT n.ImageSrc, n.nft_id, t.token_code FROM NFT n LEFT JOIN token t on t.nft_id = n.nft_id;"

        connect.query(search_sql, (err, result) =>{
            if(err){
                console.log('[SELECT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            const response = {
                statusCode: 200,
                header: {
                    "Access-Control-Allow-Header": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                },
                body: {
                    data: result
                }
            }
            res.json(response);
            connect.destroy();
            
        })
    }catch(err){
        res.json(INVALID_REQUEST_RES);
        return;
    }

    
    
})

router.get('/rank', async (req, res) => {

    var connect = mysql.createConnection(dbConfig);

    var search_sql = "SELECT * FROM NFT_Store.NFT, (SELECT L.nft_id, COUNT(nft_id) as likes FROM NFT_Store.Like L GROUP BY L.nft_id) C WHERE NFT.User_Id IS NOT null AND NFT.nft_id = C.nft_id ORDER BY C.likes DESC LIMIT 100"

    connect.query(search_sql, (err, result) =>{
        if(err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        res.json(result);
        connect.destroy();

    })

    

})

router.post('/like', async (req, res)=>{

    var connect = mysql.createConnection(dbConfig);
    
    if (!req.body.params.token || !req.body.params.nft_id){
        res.json(INVALID_REQUEST_RES);
        return;
    }

    try{
        const decode = jwt.verify(req.body.params.token, config.jwt.secret, {
            algorithm: "HS256",
          });
        var user_id = decode.user_id;
    }catch(err){
        res.json(INVALID_TOKEN_RES);
        return;
    }

    var search_sql = `SELECT * FROM NFT_Store.Like WHERE NFT_Store.Like.User_id = ${user_id} AND NFT_Store.Like.nft_id = ${req.body.params.nft_id};`

    connect.query(search_sql, (err, result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        if (result.length > 0){
            var second_sql = `DELETE FROM NFT_Store.Like WHERE User_id = ${user_id} AND NFT_Store.Like.nft_id = ${req.body.params.nft_id};`;
        }
        else{
            var second_sql = `INSERT INTO NFT_Store.Like  (User_id, nft_id) VALUES (${user_id}, ${req.body.params.nft_id});`;
        }

        connect.query(second_sql, (err, result)=>{
            if (err){
                console.log('[DELETE/INSERT ERROR] - ', err.message);
                res.json(err);
                return;
            }

            res.json(SUCCESS_RES);
            connect.destroy();
        })
    })

    
    
})

router.post('/fetchLike', async (req, res)=>{

    var connect = mysql.createConnection(dbConfig);

    if (!req.body.params.user_id){
        res.json(INVALID_REQUEST_RES);
    }

    var search_sql = `SELECT * FROM NFT_Store.Like WHERE NFT_Store.Like.User_id = ${req.body.params.user_id};`;

    connect.query(search_sql, (err, result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        res.json(result);
        connect.destroy();
    })

    

})

router.post('/share', async (req, res)=>{

    var connect = mysql.createConnection(dbConfig);

    try{
        if(!req.body.params.token || !req.body.params.nft_id || !req.body.params.targetEmail){
            res.json(INVALID_REQUEST_RES);
            return;
        }
        const decode = jwt.verify(req.body.params.token, config.jwt.secret, {
            algorithm: "HS256",
            expiresIn: "1d",
          });
        var user_id = decode.user_id;
    }catch(err){
        res.json(INVALID_TOKEN_RES);
        return;
    }
    var search_sql = `SELECT * FROM NFT WHERE User_Id = ${user_id} AND nft_id = ${req.body.params.nft_id};`
    connect.query(search_sql, (err, result)=>{
        if (err){
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }
        if (result.length > 0){

            var search_sql = `SELECT FirstName, LastName FROM NFT_Store.User WHERE User_id = ${user_id};`
            connect.query(search_sql, (err, result)=>{
                if (err){
                    console.log('[SELECT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }

                if (result.length > 0){

                    const user_name = result[0].FirstName + " " + result[0].LastName;

                    var insert_sql = `INSERT INTO Transfer (DateTime, From_User_id, nft_id) VALUES (NOW(),${user_id}, ${req.body.params.nft_id});`;

                    connect.query(insert_sql, (err, result) => {

                        if (err){
                            console.log('[SELECT ERROR] - ', err.message);
                            res.json(err);
                            return;
                        }

                        const payload = {
                            from_ac: user_id,
                            nft_id: req.body.params.nft_id,
                        }
        
                        const token = jwt.sign(payload, config.jwt.secret, {
                            algorithm: "HS256",
                            expiresIn: "2d",
                        });

                        const link_with_token = webLink + `collection/transfer/${token}`
        
                        message = {
                            from: "info@theme.com.hk",
                            to: req.body.params.targetEmail,
                            subject: `${user_name} just sent you a Rarebbit digital art!`,
                            html: `<!doctype html>
                            <html>
                                <head>
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                                    <title>${user_name} just sent you a Rarebbit digital art!</title>
                                    <style>
                                        body {
                                            background-color: #f6f6f6;
                                            width: 100%; 
                                            max-width: 800px;
                                            margin: auto;
                                        }
                            
                                        .center {
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                        }
                            
                                        .backgound {
                                            padding: 10px;
                                            background-color: #7D75FE;
                                            border-radius: 3px;
                                        }
                            
                                        .backgound:hover{
                                            cursor: pointer;
                                        }
                            
                                        span{
                                            color: #f6f6f6;
                                        }
            
                                        a{
                                            text-decoration: none;
                                        }
                            
                                    </style>
                                </head>
                                <body>
                                <div style="width: '100%';"><img src='cid:logo' style="width: '100%';" /></div>
                                <p>Hi there,</p>
                                <p>Your friend just sent you a one-of –a-kind rarebbit to you. Go to <a href="${link_with_token}">www.theme.com.hk</a> now and register to get it. You may also customize hoodies with the artwork. Try it now!</p>
                                    <a href="${link_with_token}">
                                        <div class="center">
                                            <div class="backgound">
                                                <span>Click to accept</span>
                                            </div>
                                        </div>
                                    </a>
                                    <p>Best,<br>The THEME team</p>
                                        
                                </body>`,
                                attachments: [{
                                    filename:'Email_Heading.png',
                                    path: path.join(__dirname, '../') + '/resources/static/assets/Email_Heading.png',
                                    cid:'logo'
                                }]
            
                            };
            
                        transporter.sendMail(message, function(err, info) {
                            if (err){
                                console.log(err);
                            }else{
                                console.log(info);
                            }
                        });

                        res.json(SUCCESS_RES);
                        connect.destroy();

                    })
                }
            })
        }
        else{

        }
    })

    

})

router.put('/transfer', async (req, res)=>{

    var connect = mysql.createConnection(dbConfig);

    try{
        if(!req.body.params.token || !req.body.params.transferToken){
            res.json(INVALID_REQUEST_RES);
            return;
        }
        const user_token = jwt.verify(req.body.params.token, config.jwt.secret, {
            algorithm: "HS256",
            expiresIn: "1d",
          });
        const transfer_token = jwt.verify(req.body.params.transferToken, config.jwt.secret, {
            algorithm: "HS256",
            expiresIn: "2d",
          });
        var to_user_id = user_token.user_id;
        var from_user_id = transfer_token.from_ac;
        var nft_id = transfer_token.nft_id;

        if (to_user_id !== from_user_id){

            var search_sql = `SELECT * FROM NFT WHERE User_Id = ${from_user_id} AND nft_id = ${nft_id};`
            connect.query(search_sql, (err, result)=>{
                if (err){
                    console.log('[SELECT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }
                if (result.length > 0){
                    if (from_user_id === to_user_id){
                        res.json(SUCCESS_RES);
                        return;
                    }
                    var update_sql = `UPDATE NFT SET User_Id = ${to_user_id} WHERE NFT.User_id = ${from_user_id} AND nft_id = ${nft_id};`;
                    connect.query(update_sql, (err, result)=>{
                        if (err){
                            console.log('[UPDATE ERROR] - ', err.message);
                            res.json(err);
                            return;
                        }

                        /**/
                        var insert_sql = `UPDATE Transfer SET To_User_id = ${to_user_id} , Acceptance = '1' , Accept_Date = NOW() WHERE Transfer.From_User_id = ${from_user_id} AND Transfer.nft_id = ${nft_id};`;

                        connect.query(insert_sql, (err, result)=>{
                            if (err){
                                console.log('[INSERT ERROR] - ', err.message);
                                res.json(err);
                                return;
                            }
                            res.json(SUCCESS_RES);
                            connect.destroy();
                        })
                    })
                }else{
                    const response = {
                        statusCode: 401,
                        header: {
                            "Access-Control-Allow-Header": "Content-Type",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
                        },
                        body: {
                            message: `INVALID/EXPIRED TOKEN`
                        }
                    }
                    res.json(response);
                    connect.destroy();
                    return;
                }
            })
        }else{
            res.json(INVALID_TOKEN_RES);
        }

    }catch(err){
        const response = {
            statusCode: 401,
            header: {
                "Access-Control-Allow-Header": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
            },
            body: {
                message: `Couldn't Receiver is same as sender. Please login again.`
            }
        }
        res.json(response);
        return;
    }

    
    
})

router.get('/download', async (req, res) =>{

    var nft_token_sql = 'SELECT n.ImageSrc, n.nft_id, t.token_code FROM NFT n LEFT JOIN token t on t.nft_id = n.nft_id';

    const Excel = require('exceljs');
    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet('NFT_TOKEN')

    worksheet.columns = [
        {header: 'ImageSrc', key: 'ImageSrc'},
        {header: 'nft_id', key: 'nft_id'},
        {header: 'token_code', key: 'token_code'}
      ]

    connect.query(nft_token_sql, (err, result)=>{
        if(err) {
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        result.forEach((e,index)=>{
            const rowIndex = index + 2

            worksheet.addRow({
                'ImageSrc': e['ImageSrc'],
                'nft_id': e['nft_id'],
                'token_code': e['token_code']
            });
        });
        
        workbook.xlsx.writeFile('nft.xlsx');

        res.json(result);

    })

}); 

router.get('/transfer', async(req, res)=>{

    var connect = mysql.createConnection(dbConfig);

    var transfer_sql = `SELECT DATE_FORMAT(t.DateTime, '%d/%m/%Y') DateTime, fu.User_id fm_id, fu.FirstName fm_FirstName, fu.LastName fm_LastName, tu.User_id to_id, tu.FirstName to_FirstName, tu.LastName to_LastName, t.nft_id FROM Transfer t LEFT JOIN User fu on fu.User_id = t.From_User_id RIGHT JOIN User tu on tu.User_id = t.To_User_id WHERE nft_id = "` + req.query.nft_id + `" Order By t.transferID DESC`;

    connect.query(transfer_sql, (err, result)=>{
        if(err) {
            console.log('[SELECT ERROR] - ', err.message);
            res.json(err);
            return;
        }

        const response = {
            statusCode: 200,
            header: {
                "Access-Control-Allow-Header": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS, POST, GET"
            },
            body: {
                data: result
            }
        }
        res.json(response);
        
        connect.destroy();

    })
})

router.post('/test', async (req,res) => {

    const payload = {
        email: req.query.email
    }

    const verify_token = jwt.sign(payload, config.jwt.secret, {
        algorithm: "HS256",
      });

    message = {
        from: "marklau@highfashion.com.hk",
        to: req.query.email,
        subject: "Confirm your email address",
        html: `<!doctype html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                <title>Simple Transactional Email</title>
                <style>
                    body {
                        background-color: #f6f6f6;
                        width: 100%; 
                        max-width: 800px;
                        margin: auto;
                    }
        
                    .center {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
        
                    .backgound {
                        padding: 10px;
                        background-color: #7D75FE;
                        border-radius: 3px;
                    }
        
                    .backgound:hover{
                        cursor: pointer;
                    }
        
                    span{
                        color: #f6f6f6;
                    }

                    a{
                        text-decoration: none;
                    }
        
                </style>
            </head>
            <body>
                <div style="width: '100%';"><img src='cid:logo' style="width: '100%';" /></div>
                <h3>Welcome to THEME!</h3>
                <p>You've successfully activated your THEME account. Please go to www.theme.com and log-in with your email address and password.<br>Find your token code below.<br></p>
                <a href="''">
                    <div class="center">
                        <div class="backgound">
                            <span>Confirm your Email</span>
                        </div>
                    </div>
                </a>
                <p>If you have any questions, reply to this email or contact us at info@theme.com</p>
                    
            </body>`,
            attachments: [{
                filename:'Email_Heading.png',
                path: path.join(__dirname, '../') + '/resources/static/assets/Email_Heading.png',
                cid:'logo'
            }]

    };

    transporter.sendMail(message, function(err, info) {
        if (err){
            console.log(err);
        }else{
            console.log(info);
        }
    });

    res.json(SUCCESS_RES);

})

router.post('/registerNFT', async (req,res) => {

    var register = [
        959,
        963,
        993
    ]

    for( let x = 0 ; x < register.length; x++){

        var update_sql = `UPDATE NFT SET User_Id = '1' WHERE NFT.nft_id = '${register[x]}';`;

        connect.query(update_sql, (err, result)=>{
            if (err){
                console.log('[UPDATE ERROR] - ', err.message);
                res.json(err);
                return;
            }

            var insert_sql = "INSERT INTO NFT_Store.Token_User (Token_id, User_id, DateTime )  VALUES ('" + register[x] + "', '1', '2022-11-25')";

            connect.query(insert_sql, async (err, result)=>{
                if (err){
                    console.log('[INSERT ERROR] - ', err.message);
                    res.json(err);
                    return;
                }

                    await delay(10000);

                    var insert_sql = "INSERT INTO NFT_Store.Transfer ( DateTime, From_User_id, To_User_id, nft_id ) VALUES ('2022-11-25', '0', '1', '" + register[x] + "');" ;

                    connect.query(insert_sql, (err, result)=>{
                        if (err){
                            console.log('[INSERT ERROR] - ', err.message);
                            res.json(err);
                            return;
                        }

                        res.json(SUCCESS_RES);

                    })

                
            })
        })

    }

})

function delay(time) {
    return new Promise (resolve => setTimeout(resolve, time));
}

module.exports = router;