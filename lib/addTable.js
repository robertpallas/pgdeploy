'use strict';

const inquirer = require('inquirer');
const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');

let save = {};

module.exports=addTable;

function addTable(latestRelease, directory) {

	save.latestRelease = latestRelease;
	save.directory = directory;

	let schemas = files.getSchemas(directory);

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
			message: 'Add creation_time?',
			default: true
		},
		{
			type: 'confirm',
			name: 'update',
			message: 'Add update_time?',
			default: true
		}
	], askColumn);
}

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
		if (colRes.addMore) {
			askColumn(res);
		} else {
			let filename = '/' + save.directory + '/' + res.schema + '/tables/create_' + res.table + '.' + save.latestRelease + '.sql';
			pgdeploy.info('New file: ' + filename);

			files.createFileFromTemplate(filename, 'create_table', res);

			pgdeploy.info('Table ' + res.schema + '.' + res.table + ' added');
		}
	});
}
