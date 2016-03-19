'use strict';

const inquirer = require('inquirer');
const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');

module.exports=addSchema;

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
	], function(res) {
		let path = '/' + directory + '/' + res.name;
		let filename = path + '/create_schema.' + latestRelease + '.sql';
		pgdeploy.info('New file: ' + filename);

		files.createFileFromTemplate(filename, 'create_schema', res);

		files.createDir(path + '/tables');
		files.createDir(path + '/functions');
		files.createDir(path + '/tests');

		pgdeploy.info('Schema ' + res.name + ' added');
	});
}
