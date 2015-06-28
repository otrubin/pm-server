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
        removelogging: {
            dist: {
                files: [{
                    expand: true,
                    src: ['db3.js','hit.js'],
                    dest: 'build/'
                }]
            },
            options: {
                methods: ['log', 'info', 'assert']
            }
        },
        ftp_push: {
            pm_server_common: {
                options: {
                    host: "perfectmarketing.ru",
                    dest: "/www/w.perfectmarketing.ru/build/",
                    username: "perfectmarketing",
                    password: "IjUv2Hs1"
                },
                files: [
                    {
                        expand: true,
                        cwd: 'build',
                        src: ['hit.js','db3.js']
                    }
                ]
            },
            pm_server_utils: {
                options: {
                    host: "perfectmarketing.ru",
                    dest: "/www/w.perfectmarketing.ru/build/utils",
                    username: "perfectmarketing",
                    password: "IjUv2Hs1"
                },
                files: [
                    {
                        expand: true,
                        cwd: 'utils',
                        src: ['crc32.js']
                    }
                ]
            },
            pm_server_common_debug: {
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
                        src: ['hit.js','db3.js']
                    }
                ]
            },
            pm_server_utils_debug: {
                options: {
                    host: "perfectmarketing.ru",
                    dest: "/www/w.perfectmarketing.ru/build/utils",
                    username: "perfectmarketing",
                    password: "IjUv2Hs1"
                },
                files: [
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
    grunt.loadNpmTasks('grunt-remove-logging');
    grunt.loadNpmTasks('grunt-ftp-push');

    grunt.registerTask('default', ['jshint:pm_server','removelogging','ftp_push:pm_server_common','ftp_push:pm_server_utils']);
    grunt.registerTask('debug', ['jshint:pm_server','ftp_push:pm_server_common_debug','ftp_push:pm_server_utils_debug']);

};
