#!/usr/bin/env node --harmony
'use strict';

const program = require('commander');
const rarra = require('./lib/rarra.js');
const releases = require('./lib/releases.js');

program.version('0.1.0');

program
	.command('init')
	.description('initialize Rarra project')
	.option('-f, --force', 'Deletes previously initialized project')
	.action(require('./lib/init.js'));

program
	.command('setup [env]')
	.description('add another database environment to manage')
	.action(function(env) {
		let setupEnv = require('./lib/setupEnvironment.js');
		setupEnv(env, function(err) {
			if(err) {
				rarra.error(err);
			} else {
				rarra.success();
			}
		});
	});

program
	.command('add [what]')
	.description('add a release or schema/table/function into latest release')
	.action(function(what) {
		let latestRelease = releases.getLatestRelease();
		let directory = rarra.getConfig().directory;
		let whatFile = what.substr(0, 1).toUpperCase() + what.substr(1).toLowerCase();

		let call = require('./lib/add' + whatFile + '.js');
		call(latestRelease, directory);

		rarra.success();
	});

program
	.command('deploy')
	.description('deploy the unreleased releases to environment')
	.option('-c, --clean', 'Deletes everything in the environment database before deploy')
	.option('-g, --generate', 'Generate test data after deploy')
	.option('-d, --dry-run', 'Dry run shows you what it deploys but wont commit anything')
	//.option('-v, --verbose', 'Debug your release in more words')
	.option('-s, --single', 'Deploy only next unreleased version')
	.action(require('./lib/deploy.js'));

program.parse(process.argv);