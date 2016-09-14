// jshint esversion: 6
const gulp = require("gulp"),
    uglify = require("gulp-uglify"),
    rename = require("gulp-rename"),
    filever = require('gulp-ver'),
    jsFile = "./jsoneditor.js";

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