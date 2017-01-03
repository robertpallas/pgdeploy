const inquirer = require('inquirer');

const pgdeploy = require('./pgdeploy.js');
const copy = require('./copy.js');
const files = require('./files.js');

function importData(callback, env) {
    const backups = files.getBackups(`${process.cwd()}/${pgdeploy.getConfig().directory}`);

    if(!backups.length) {
        pgdeploy.error('No backups. Run "pgdeploy export"?');
    }

    const questions = [
        {
            type: 'list',
            name: 'backup',
            message: 'Backup',
            choices: backups
        }
    ];

    if(!env) {
        const envNames = pgdeploy.geEnvironmentNames();
        questions.unshift({
            type: 'list',
            name: 'env',
            message: 'Environment',
            choices: envNames
        });
    }

    inquirer.prompt(questions, (res) => {
        copy.toDb(env || res.env, res.backup, callback);
    });
}

module.exports = importData;
