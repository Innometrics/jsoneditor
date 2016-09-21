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

gulp.task("build", function () {
    return gulp.src(jsFile)
            .pipe(filever())
            .pipe(gulp.dest("dist"))
            .pipe(uglify())
            .pipe(rename({
                extname: ".min.js"
            }))
            .pipe(gulp.dest("dist"));
});

gulp.task("upload2s3", function (cb) {
    var awsConfig;
    try {
        awsConfig = require("./aws.cfg.json");
    } catch (e) {
        throw new Error("You have incorrect or empty AWS config file. (aws.cfg.json)");
    }

    var awsS3 = new aws.S3(awsConfig);

    async.each([
        "jsoneditor-" + projectCfg.version + ".js",
        "jsoneditor-" + projectCfg.version + ".min.js"
    ], function (item, callback) {
        fs.readFile(__dirname + "/dist/" + item, function (error, buffer) {
            if (error) {
                throw error;
            }
            let cfg = {
                Bucket: awsConfig.bucket,
                Key: awsConfig.path + '/' + item,
                Body: buffer,
                ACL: "public-read",
                ContentType: "text/javascript"
            };

            awsS3.putObject(cfg, function (error, response) {
                if (error) {
                    throw error;
                }

                callback();
            });
        });
    }, function (err) {
        console.log("All files uloaded");
        cb();
    });
});