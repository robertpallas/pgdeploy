'use strict';

const inquirer = require('inquirer');

const rarra = require('./rarra.js');
const copy = require('./copy.js');
const files = require('./files.js');

module.exports=importData;

function importData() {

	let envNames = rarra.geEnvironmentNames();
	let backups = files.getBackups(process.cwd() + '/' + rarra.getConfig().directory);

	if(!backups.length) {
		rarra.error('No backups. Run "rarra export"?')
	}

	inquirer.prompt([
		{
			type: 'list',
			name: 'env',
			message: 'Environment',
			choices: envNames
		},
		{
			type: 'list',
			name: 'backup',
			message: 'Backup',
			choices: backups
		},
	], function(res) {
		copy.toDb(res.env, res.backup);
	});
}