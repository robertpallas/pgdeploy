const inquirer = require('inquirer');
const async = require('async');
const fs = require('fs');

const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const setupEnv = require('./setupEnvironment.js');
const addRelease = require('./addRelease.js');

function init(options) {
    if(fs.existsSync(pgdeploy.configFile)) {
        if(options.force) {
            fs.unlinkSync(pgdeploy.configFile);
        } else {
            pgdeploy.error('Project already initialized. Check pgdeploy.json. Use -f to force config override.');
        }
    }

    inquirer.prompt([
        {
            type: 'input',
            name: 'directory',
            message: 'Directory to keep your SQL files and tests',
            default: 'db'
        },
        {
            type: 'checkbox',
            message: 'Select environments you wish to init',
            name: 'environments',
            choices: [
                {
                    name: 'local'
                },
                {
                    name: 'dev'
                },
                {
                    name: 'live'
                }
            ]
        }
    ], (res) => {
        // init config
        fs.closeSync(fs.openSync(pgdeploy.configFile, 'w'));
        const config = {
            directory: res.directory,
            environments: {}
        };
        pgdeploy.setConfig(config);

        if(!fs.existsSync(res.directory)) {
            fs.mkdirSync(res.directory);
        }

        files.copyDir(`${__dirname}/templates/utils`, `${res.directory}/utils`);

        async.eachSeries(res.environments, setupEnv, (err) => {
            if(err) {
                pgdeploy.error(err);
            } else {
                // insert for first release
                addRelease('v00000', pgdeploy.getConfig().directory);

                pgdeploy.success('pgdeploy project initialized, check pgdeploy.json');
            }
        });
    });
}

module.exports = init;
