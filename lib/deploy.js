'use strict';

const inquirer = require('inquirer');
const async = require('async');
const pg = require('pg');
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');
const releases = require('./releases.js');
const importData = require('./import.js');
const test = require('./test.js');

let deployHelper = {
	options: {},
	releaseVersion: null,
	env: null
};

module.exports=deploy;

function deploy(options) {

	deployHelper.options = options;

	let envNames = pgdeploy.geEnvironmentNames();

	inquirer.prompt([
		{
			type: 'list',
			name: 'env',
			message: 'Environment',
			choices: envNames
		}
	], (res) => {

		deployHelper.env = res.env;

		checkOptions(() => {
			cleanDatabase(() => {
				db.getLastReleaseVersion(res.env, (err, ver) => {
					if(err) {
						pgdeploy.error(err);
					}

					if(!ver) {
						ver = 'v00000';
					}

					deployHelper.releaseVersion = releases.getNextReleaseVersion(ver);

					async.doUntil(deployRelease, checkNextDeploy, err => {

						if(err) {
							pgdeploy.warn(err);

							let errMsg = 'Failed to deploy.';
							if(!deployHelper.options.notTransaction) {
								errMsg += ' Rollback.';
							}
							pgdeploy.error(errMsg);
						}

						if(deployHelper.options.generate) {
							pgdeploy.info('');
							pgdeploy.info('Choose a backup to generate data from');
							importData(() => {
								pgdeploy.info('Data inserted');
								testAndFinish();
							}, deployHelper.env);
						} else {
							testAndFinish();
						}
					});
				});
			});
		});
	});
}

function cleanDatabase(callback) {

	let user = pgdeploy.getConfig().environments[deployHelper.env].username;

	if(deployHelper.options.clean) {
		db.query(deployHelper.env, 'drop owned by '+user+';', [], (err, result) => {
			if(err) {
				callback(err);
			}

			pgdeploy.info('Database cleaned, everything deleted.');

			db.init(deployHelper.env, callback);
		});
	} else {
		callback();
	}
}

function checkNextDeploy() {
	// if only one release was supposed to be deployed or the next release has no files stop deploying releases
	return deployHelper.options.single || !releases.getReleaseFiles(deployHelper.releaseVersion).length;
}

function deployRelease(callback) {
	let ver = deployHelper.releaseVersion;
	let releaseFiles = releases.getReleaseFiles(ver);

	pgdeploy.info('');
	pgdeploy.info(releaseFiles.length + ' files in release ' + ver);

	if(!releaseFiles.length) {
		pgdeploy.error('No files to release. Do "pgdeploy add release"?');
	}

	if(releaseFiles.length < 2) {
		pgdeploy.error('There is no point to deploy release with less than 2 files since one is always release version insert.');
	}

	if(deployHelper.options.notTransaction && releaseFiles.length != 2) {
		pgdeploy.error('You can only deploy 1 file besides the release insert without transactions. For your safety.');
	}

	deployHelper.releaseVersion = releases.getNextReleaseVersion(deployHelper.releaseVersion);

	pg.connect(db.getConnectionString(deployHelper.env), (err, db, done) => {
		if(err) {
			callback(err);
		}

		let txCommands = {
			begin: 'begin',
			commit: 'commit'
		};

		if(deployHelper.options.notTransaction) {
			txCommands = {
				begin: 'select true;',
				commit: 'select true;'
			}
		}

		// deploy releases to the database in one transaction
		db.query(txCommands.begin, [], err => {
			if(err) {
				callback(err);
			}

			async.each(releaseFiles, (filename, callback) => {
				let sqlFileContents = files.readFile(filename);

				if(deployHelper.options.verbose || deployHelper.options.dryRun) {
					pgdeploy.info(filename + ':');
					pgdeploy.info('-----------');
					console.log(sqlFileContents);
					pgdeploy.info('');
				}

				if(!deployHelper.options.dryRun) {
					db.query(sqlFileContents, [], err => {
						pgdeploy.info('Deploy ' + filename);
						callback(err)
					});
				} else {
					callback();
				}
			}, err => {
				if(err) {
					callback(err);
				}

				db.query(txCommands.commit, [], err => {
					done();
					callback(err);
				});
			});
		});
	});
}

function doNotCleanGenerateOrTest() {
	if(deployHelper.options.clean) {
		pgdeploy.warn('Will not clean the database');
	}

	if(deployHelper.options.generate) {
		pgdeploy.warn('Will not generate test data');
	}

	if(deployHelper.options.test) {
		pgdeploy.warn('Will not run tests');
	}

	deployHelper.options.clean = false;
	deployHelper.options.generate = false;
	deployHelper.options.test = false;
}

function checkOptions(callback) {
	let env = pgdeploy.getConfig().environments[deployHelper.env];
	let callDoNotClean = false;

	if(env.protected) {
		pgdeploy.info(deployHelper.env + ' is protected environment.');

		callDoNotClean = true;

		if(!deployHelper.options.single) {
			pgdeploy.warn('Will only deploy single version');
		}

		deployHelper.options.single = true;
	}

	if(deployHelper.options.dryRun) {
		pgdeploy.info('Doing a dry run. No changes are made to the database.');

		callDoNotClean = true;
	}

	if(deployHelper.options.notTransaction && !deployHelper.options.single) {
		deployHelper.options.single = true;
		pgdeploy.warn('Using no transactions you can only release single version. Forced the release to 1 version.')
	}

	if(callDoNotClean) {
		doNotCleanGenerateOrTest();
	}

	if(env.protected && !deployHelper.options.dryRun) {
		inquirer.prompt([
			{
				type: 'list',
				name: 'release',
				message: 'Are you sure you wish to release?',
				choices: ['No', 'Yes', 'Maybe']
			}
		], (res) => {
			if(res.release === 'Yes') {
				callback();
			} else {
				pgdeploy.error('OK, no release.');
			}
		});
	} else {
		callback();
	}
}

function testAndFinish() {
	if(deployHelper.options.test) {
		pgdeploy.info('Starting tests');
		test(deployHelper.env, failures => {
			if(failures) {
				pgdeploy.error('Tests failed');
			} else {
				pgdeploy.success();
			}
		});
	} else {
		pgdeploy.success();
	}
}
