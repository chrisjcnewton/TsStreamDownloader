module.exports = function(grunt) {

  //var jsSourceFiles = ['src/js/viewControllers/*.js','src/js/views/*.js', 'src/js/libs/*.js', 'src/js/utils/*.js', 'src/js/*.js'];
  var jsSourceFiles = ['src/js/**/*.js'];

  // 1. All configuration goes here
  grunt.initConfig({
    pkg : grunt.file.readJSON('package.json'),

    concat : {
      // 2. Configuration for concatinating files goes here.
      distjs : {
        src : jsSourceFiles,
        dest : 'build/app-data/js/<%= pkg.name %>.js',
      }/*,
      distcss : {
        src : ['src/css/*.css'],
        dest : 'build/css/<%= pkg.name %>.css',
      }*/
    },
    uglify : {
      build : {
        src : 'build/app-data/js/<%= pkg.name %>.js',
        dest : 'build/app-data/js/<%= pkg.name %>.min.js'
      }
    },
    imagemin : {
      dynamic : {
        files : [{
          expand : true,
          cwd : 'src/images/',
          src : ['**/*.{png,jpg,gif}'],
          dest : 'build/app-data/images/'
        }]
      }
    },
    watch : {
      scripts : {
        files : jsSourceFiles,
        tasks : ['concat:distjs', 'uglify'],
        options : {
          spawn : false,
        }
      },/*
      styles : {
        files : ['src/css/*.css'],
        tasks : ['concat:distcss'],
        options : {
          spawn : false,
        }
      }*/
      sass : {
        files : ['src/sass/**/*.scss'],
        tasks : ['compass:dev'],
        options : {
          spawn : false,
        }
      }
    },
    copy: {
      buildToRelease: {
        expand : true,
        src: ['**/*','!app-data/snapshot.bin'],
        dest: 'release/',
        cwd: 'build/'

      },
    },
    compass: {                  // Task
      dist: {                   // Target
        options: {              // Target options
          sassDir: 'src/sass',
          cssDir: 'build/app-data/css',
          outputStyle: 'compressed',
          environment: 'production'
        }
      },
      dev: {                    // Another target
        options: {
          sassDir: 'src/sass',
          cssDir: 'build/app-data/css'
        }
      }
    },
    exec: {
      compileJsToBin: {
        //cmd: "/Applications/node-webkit-v0.11.6-osx-ia32/nwsnapshot --extra_code ./src/compiled-js/compiled.js ./build/app-data/snapshot.bin"
        cmd: "/Applications/nwjs-v0.12.0-osx-x64/nwjc ./src/compiled-js/compiled.js ./build/app-data/snapshot.bin"
      }
    }

  });

  // 3. Where we tell Grunt we plan to use this plug-in.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  //grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compass');
  grunt.loadNpmTasks('grunt-exec');


  // 4. Where we tell Grunt what to do when we type "grunt" into the terminal.

  grunt.registerTask('default', ['concat:distjs', 'uglify', 'compass:dist']);


};
