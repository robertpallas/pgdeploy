'use strict';

const inquirer = require('inquirer');

const rarra = require('./rarra.js');
const copy = require('./copy.js');

module.exports=exportData;

function exportData() {

	let envNames = rarra.geEnvironmentNames();

	inquirer.prompt([
		{
			type: 'list',
			name: 'env',
			message: 'Environment',
			choices: envNames
		},
		{
			type: 'input',
			name: 'name',
			message: 'Export name',
			validate(str) {
				return str.length && /^[0-9A-Za-z_]*$/.test(str);
			},
			filter(str) {
				return str.toLowerCase();
			}
		}
	], function(res) {
		copy.fromDb(res.env, '/' + rarra.getConfig().directory + '/__backups/' + res.name);
	});
}