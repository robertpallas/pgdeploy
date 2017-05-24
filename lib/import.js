const inquirer = require('inquirer');
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');
const copy = require('./copy.js');
const files = require('./files.js');

function importData(callback, env, backup) {
    const backups = files.getBackups(`${process.cwd()}/${pgdeploy.getConfig().directory}`);
    const envNames = pgdeploy.geEnvironmentNames();

    if(!backups.length) {
        pgdeploy.error('No backups. Run "pgdeploy export"?');
    }

    const questions = [];

    if(!env) {
        questions.push({
            type: 'list',
            name: 'env',
            message: 'Environment',
            choices: envNames
        });
    }

    if(!backup || typeof backup === 'boolean') {
        questions.push({
            type: 'list',
            name: 'backup',
            message: 'Backup to generate data from',
            choices: backups
        });
    } else if(!_.includes(backups, backup)) {
        pgdeploy.error(`${backup} does not exist in __backups`);
    }

    inquirer.prompt(questions, (res) => {
        copy.toDb(res.env || env, res.backup || backup, callback);
    });
}

module.exports = importData;
