'use strict';

const chalk = require('chalk');
const fs = require('fs');
const _ = require('lodash');

let pgdeploy = {
	configFile:  process.cwd() + '/pgdeploy.json',

	error(err) {
		console.log(chalk.red.bold(err));
		process.exit(1);
	},

	warn(msg) {
		console.log('    ' + chalk.red(msg));
	},

	success(msg) {
		if(!msg) {
			msg = 'Done!';
		}
		console.log(chalk.green.bold(msg));
		process.exit(0);
	},

	info(msg) {
		console.log('    ' + chalk.green(msg));
	},

	getConfig() {
		let config = require(this.configFile);
		if(!config || !config.directory) {
			this.error('Config not found at ' + this.configFile + '. Check your current directory or initialize project with "pgdeploy init"');
		} else {
			return config;
		}
	},

	setConfig(config) {
		fs.writeFileSync(this.configFile, JSON.stringify(config, null, '\t'));
	},

	getUser() {
		return process.env.USER;
	},

	geEnvironmentNames() {
		let envs = this.getConfig().environments;
		return _.keys(envs);
	}
};

module.exports = pgdeploy;
