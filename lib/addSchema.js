'use strict';

const inquirer = require('inquirer');
const rarra = require('./rarra.js');
const files = require('./files.js');

module.exports=addSchema;

function addSchema(latestRelease, directory) {

	inquirer.prompt([
		{
			type: 'input',
			name: 'name',
			message: 'Schema name',
			validate: function(str) {
				return str.length && /^[A-Za-z_]*$/.test(str);
			},
			filter: function(str) {
				return str.toLowerCase();
			}
		}
	], function(res) {
		let path = '/' + directory + '/' + res.name;
		let filename = path + '/create_schema.' + latestRelease + '.sql';
		rarra.info('New file: ' + filename);

		files.createFileFromTemplate(filename, 'create_schema', res);

		files.createDir(path + '/tables');
		files.createDir(path + '/functions');
		files.createDir(path + '/tests');

		rarra.info('Schema ' + res.name + ' added');
	});
}
