'use strict';

const inquirer = require('inquirer');

const rarra = require('./rarra.js');
const copy = require('./copy.js');
const files = require('./files.js');

module.exports=importData;

function importData(callback, env) {

	let backups = files.getBackups(process.cwd() + '/' + rarra.getConfig().directory);

	if(!backups.length) {
		rarra.error('No backups. Run "rarra export"?')
	}

	let questions = [
		{
			type: 'list',
			name: 'backup',
			message: 'Backup',
			choices: backups
		},
	];

	if(!env) {
		let envNames = rarra.geEnvironmentNames();
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