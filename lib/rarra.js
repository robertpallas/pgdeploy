'use strict';

const chalk = require('chalk');
const fs = require('fs');

var rarra = {
	configFile:  process.cwd() + '/rarra.json',

	error: function(err) {
		console.log(chalk.red.bold(err));
		process.exit(1);
	},

	warn: function(msg) {
		console.log('    ' + chalk.red(msg));
	},

	success: function(msg) {
		if(!msg) {
			msg = 'Done!';
		}
		console.log(chalk.green.bold(msg));
		process.exit(0);
	},

	info: function(msg) {
		console.log('    ' + chalk.green(msg));
	},

	getConfig: function() {
		let config = require(this.configFile);
		if(!config || !config.directory) {
			this.error('Config not found at ' + this.configFile + '. Check your current directory or initialize project with "rarra init"');
		} else {
			return config;
		}
	},

	setConfig: function(config) {
		fs.writeFileSync(this.configFile, JSON.stringify(config, null, '\t'));
	},

	getUser: function() {
		return process.env.USER;
	}
};

module.exports = rarra;
