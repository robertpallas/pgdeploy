const inquirer = require('inquirer');
const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');

function addSchema(latestRelease, directory) {
    inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Schema name',
            validate(str) {
                return str.length && /^[A-Za-z_]*$/.test(str);
            },
            filter(str) {
                return str.toLowerCase();
            }
        }
    ], (res) => {
        const path = `/${directory}/${res.name}`;
        const filename = `${path}/create_schema.${latestRelease}.sql`;
        pgdeploy.info(`New file: ${filename}`);

        files.createFileFromTemplate(filename, 'create_schema.sql', res);

        files.createDir(`${path}/tables`);
        files.createDir(`${path}/functions`);
        files.createDir(`${path}/tests`);

        pgdeploy.info(`Schema ${res.name} added`);
    });
}

module.exports = addSchema;
