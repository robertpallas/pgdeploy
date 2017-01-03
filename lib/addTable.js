const inquirer = require('inquirer');
const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');

const save = {};

function askColumn(res) {
    inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Column name',
            validate(str) {
                return str.length && /^[A-Za-z_]*$/.test(str);
            },
            filter(str) {
                return str.toLowerCase();
            }
        },
        {
            type: 'list',
            name: 'type',
            message: 'Column type',
            choices: db.dataTypes
        },
        {
            type: 'confirm',
            name: 'notNull',
            message: 'Add not null?',
            default: true
        },
        {
            type: 'input',
            name: 'default',
            message: 'Default value'
        },
        {
            type: 'confirm',
            name: 'addMore',
            message: 'Add more columns?',
            default: true
        }
    ], (colRes) => {
        if(!res.columns) {
            res.columns = [];
        }
        res.columns.push(colRes);
        if(colRes.addMore) {
            askColumn(res);
        } else {
            const filename = `/${save.directory}/${res.schema}/tables/create_${res.table}.${save.latestRelease}.sql`;
            pgdeploy.info(`New file: ${filename}`);

            files.createFileFromTemplate(filename, 'create_table.sql', res);

            pgdeploy.info(`Table ${res.schema}.${res.table} added`);
        }
    });
}

function addTable(latestRelease, directory) {
    save.latestRelease = latestRelease;
    save.directory = directory;

    const schemas = files.getSchemas(directory);

    if(!schemas.length) {
        pgdeploy.error('There are no schemas, add a schema first!');
    }

    inquirer.prompt([
        {
            type: 'list',
            name: 'schema',
            message: 'Schema',
            choices: schemas
        },
        {
            type: 'input',
            name: 'table',
            message: 'Table name',
            validate(str) {
                return str.length && /^[A-Za-z_]*$/.test(str);
            },
            filter(str) {
                return str.toLowerCase();
            }
        },
        {
            type: 'confirm',
            name: 'creation',
            message: 'Add created_at?',
            default: true
        },
        {
            type: 'confirm',
            name: 'update',
            message: 'Add updated_at?',
            default: true
        }
    ], askColumn);
}


module.exports = addTable;
