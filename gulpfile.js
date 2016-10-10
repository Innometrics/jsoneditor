// jshint esversion: 6
const gulp = require("gulp"),
    uglify = require("gulp-uglify"),
    rename = require("gulp-rename"),
    filever = require('gulp-ver'),
    jsFile = "./jsoneditor.js",
    async = require("async"),
    fs = require("fs"),
    projectCfg = require("./package.json"),
    aws = require("aws-sdk");

function errorHandler (error) {
    return console.error(error.message);
}

gulp.task("build", function () {
    return gulp.src(jsFile)
            .pipe(filever().on('error', errorHandler))
            .pipe(gulp.dest("dist"))
            .pipe(uglify().on('error', errorHandler))
            .pipe(rename({
                extname: ".min.js"
            }).on('error', errorHandler))
            .pipe(gulp.dest("dist"));
});

gulp.task("upload2s3", function (callback) {
    var awsConfig;
    try {
        awsConfig = require("./aws.cfg.json");
    } catch (e) {
        return callback("You have incorrect or empty AWS config file. (aws.cfg.json)");
    }

    var awsS3 = new aws.S3(awsConfig);

    async.each([
        "jsoneditor-" + projectCfg.version + ".js",
        "jsoneditor-" + projectCfg.version + ".min.js"
    ], function (item, innerCallback) {
        fs.readFile(__dirname + "/dist/" + item, function (error, buffer) {
            if (error) {
                return innerCallback(error);
            }
            let cfg = {
                Bucket: awsConfig.bucket,
                Key: awsConfig.path + '/' + item,
                Body: buffer,
                ACL: "public-read",
                ContentType: "text/javascript"
            };

            awsS3.putObject(cfg, function (error) {
                if (error) {
                    return innerCallback(error);
                }

                innerCallback();
            });
        });
    }, function (error) {
        if (error) {
            return callback(error);
        }

        console.log("All files uloaded");
        return callback();
    });
});
