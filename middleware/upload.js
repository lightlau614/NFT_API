const util = require("util");
const multer = require("multer");
const AWS = require('aws-sdk');

const maxSize = 2 * 1024 * 1024;

let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_S3_ACCESS_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    });
    
    const uploadedImage = s3.upload({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Region: process.env.AWS_S3_REGION,
      Key: file.originalname,
      Body: JSON.stringify(file, null, 2),
    })

    var promise = uploadedImage.promise();
    // cb(null, process.cwd() + "/resources/static/assets/uploads/");
    // console.log(process.cwd() + "/resources/static/assets/uploads/");
  },
  filename: (req, file, cb) => {
    // console.log(file.originalname);
    // cb(null, file.originalname);
  },
});
let uploadFile = multer({
  storage: storage,
  limits: { fileSize: maxSize },
}).single("file");
let uploadFileMiddleware = util.promisify(uploadFile);
module.exports = uploadFileMiddleware;