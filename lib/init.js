'use strict';

const inquirer = require('inquirer');
const async = require('async');
const fs = require('fs');
const rarra = require('./rarra.js');

module.exports=init;

function init(options){

	if (fs.existsSync(rarra.configFile)) {
		if(options.force) {
			fs.unlinkSync(rarra.configFile);
		} else {
			rarra.error('Project already initialized. Check rarra.json. Use -f to force config override.');
		}
	}

	inquirer.prompt([
		{
			type: "input",
			name: "directory",
			message: 'Directory to keep your SQL files and tests',
			default: 'db'
		},
		{
			type: "checkbox",
			message: "Select environments you wish to init",
			name: "environments",
			choices: [
				{
					name: "local"
				},
				{
					name: "dev"
				},
				{
					name: "live"
				}
			]
		}
	], function(res) {
		// init config
		fs.closeSync(fs.openSync(rarra.configFile, 'w'));
		let config = {directory: res.directory, environments: {}};
		rarra.setConfig(config);

		if (!fs.existsSync(res.directory)) {
			fs.mkdirSync(res.directory);
		}

		async.eachSeries(res.environments, require('./setupEnvironment.js'), function(err) {
			if(err) {
				rarra.error(err);
			} else {
				// insert for first release
				require('./addRelease.js')('v00000', rarra.getConfig().directory);

				rarra.success('Rarra project initialized, check rarra.json');
			}
		});
	});
}
