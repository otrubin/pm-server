/**
 * Created by Oleg on 12.06.2015.
 */

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            pm_server:{
                src: ['watch.js','db3.js']
            }
        },
        ftp_push: {
            pm_server: {
                options: {
                    host: "perfectmarketing.ru",
                    dest: "/www/w.perfectmarketing.ru/build/",
                    username: "perfectmarketing",
                    password: "IjUv2Hs1"
                },
                files: [
                    {
                        expand: true,
                        cwd: '.',
                        src: ['watch.js','db3.js']
                    },
                    {
                        expand: true,
                        cwd: 'utils',
                        src: ['crc32.js']
                    }
                ]
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-ftp-push');

    grunt.registerTask('default', ['jshint:pm_server','ftp_push:pm_server']);

};
