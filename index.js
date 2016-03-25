#!/usr/bin/env node --harmony
'use strict';

const program = require('commander');
const pgdeploy = require('./lib/pgdeploy.js');

program.version(require('./package.json').version);

program
	.command('init')
	.description('initialize pgdeploy project')
	.option('-f, --force', 'Deletes previously initialized project')
	.action(options => require('./lib/init.js')(options));

program
	.command('setup [env]')
	.description('add another database environment to manage')
	.action(env => {
		let setupEnv = require('./lib/setupEnvironment.js');
		setupEnv(env, (err) => {
			if(err) {
				pgdeploy.error(err);
			} else {
				pgdeploy.success();
			}
		});
	});

program
	.command('add [what]')
	.description('add a release or schema/table/function into latest release')
	.action(what => {
		let latestRelease = require('./lib/releases.js').getLatestRelease();
		let directory = pgdeploy.getConfig().directory;
		let whatFile = what.substr(0, 1).toUpperCase() + what.substr(1).toLowerCase();

		let call = require('./lib/add' + whatFile + '.js');
		call(latestRelease, directory);

		//pgdeploy.success();
	});

program
	.command('deploy')
	.description('deploy the unreleased releases to environment')
	.option('-c, --clean', 'Deletes everything in the environment database before deploy')
	.option('-g, --generate', 'Generate test data from one of the backups after deploy with import')
	.option('-d, --dry-run', 'Dry run shows you what it deploys but wont commit anything')
	.option('-v, --verbose', 'Log your release process in more detail')
	.option('-s, --single', 'Deploy only next unreleased version')
	.option('-t, --test', 'Run tests')
	.option('-n, --not-transaction', 'Deploy by committing release sql files one by one rather than as a patch in a transaction. Allows only single working file besides the release.')
	.action(options => require('./lib/deploy.js')(options));

program
	.command('export')
	.description('Export all data from tables to a local back-up')
	.action(() => require('./lib/export.js')());

program
	.command('import')
	.description('Import data from local back-up into one of the environments database tables')
	.action(() => {
		require('./lib/import.js')(() => {
			pgdeploy.success('All found files done');
		});
	});

program
	.command('test [env]')
	.description('Run all test files')
	.action(env => require('./lib/test.js')(env));

program.parse(process.argv);