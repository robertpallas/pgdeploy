const inquirer = require('inquirer');

const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');

function setupEnvironment(env, callback) {
    inquirer.prompt([
        {
            type: 'input',
            name: 'host',
            message: `[${env.toUpperCase()}] PostgreSQL host location with port number`,
            default: 'localhost:5432'
        },
        {
            type: 'input',
            name: 'username',
            message: `[${env.toUpperCase()}] Username`
        },
        {
            type: 'password',
            name: 'password',
            message: `[${env.toUpperCase()}] Password`
        },
        {
            type: 'input',
            name: 'database',
            message: `[${env.toUpperCase()}] Database`
        },
        {
            type: 'confirm',
            name: 'protected',
            message: 'Protected from cleanup and test data generation?',
            default: true
        }
    ], (res) => {
        const config = pgdeploy.getConfig();
        config.environments[env] = res;
        pgdeploy.setConfig(config);

        db.init(env, callback);
    });
}

module.exports = setupEnvironment;
