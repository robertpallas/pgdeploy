'use strict';

const inquirer = require('inquirer');
const async = require('async');
const pg = require('pg');
const _ = require('lodash');

const rarra = require('./rarra.js');
const db = require('./db.js');
const files = require('./files.js');
const releases = require('./releases.js');

var deployHelper = {
	options: {},
	releaseVersion: null,
	env: null
};

module.exports=deploy;

function deploy(options) {

	deployHelper.options = options;

	let envs = rarra.getConfig().environments;
	let envNames = _.keys(envs);

	inquirer.prompt([
		{
			type: 'list',
			name: 'env',
			message: 'Environment',
			choices: envNames
		}
	], function(res) {

		let env = rarra.getConfig().environments[res.env];
		deployHelper.env = res.env;

		if(env.protected) {
			rarra.info(res.env + ' is protected environment.');

			if(deployHelper.options.clean) {
				rarra.warn('Will not clean the database');
			}

			if(deployHelper.options.generate) {
				rarra.warn('Will not generate test data');
			}

			_.unset(deployHelper.options, ['clean', 'generate']);

			if(!deployHelper.options.single) {
				rarra.warn('Will only deploy single version');
			}

			deployHelper.options.single = true;
		}

		if(deployHelper.options.notTransaction && !deployHelper.options.single) {
			deployHelper.options.single = true;
			rarra.warn('Using no transactions you can only release single version. Forced the release to 1 version.')
		}

		cleanDatabase(function() {
			db.getLastReleaseVersion(res.env, function(err, ver) {
				if(err) {
					rarra.error(err);
				}

				if(!ver) {
					ver = 'v00000';
				}

				deployHelper.releaseVersion = releases.getNextReleaseVersion(ver);

				async.doUntil(deployRelease, checkNextDeploy, function(err){
					if(err) {
						rarra.warn(err);

						let errMsg = 'Failed to deploy.';
						if(!deployHelper.options.notTransaction) {
							errMsg += ' Rollback.';
						}
						rarra.error(errMsg);
					}

					rarra.success();
				});
			});
		});
	});
}

function cleanDatabase(callback) {
	let user = rarra.getConfig().environments[deployHelper.env].username;

	if(deployHelper.options.clean) {
		db.query(deployHelper.env, 'drop owned by '+user+';', function(err, result) {
			if(err) {
				callback(err);
			}

			rarra.info('Database cleaned, everything deleted.');

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

	rarra.info(releaseFiles.length + ' files in release ' + ver);

	if(!releaseFiles.length) {
		rarra.error('No files to release. Do "rarra add release"?');
	}

	if(releaseFiles.length < 2) {
		rarra.error('There is no point to deploy release with less than 2 files since one is always release version insert.');
	}

	if(deployHelper.options.notTransaction && releaseFiles.length != 2) {
		rarra.error('You can only deploy 1 file besides the release insert without transactions. For your safety.');
	}

	deployHelper.releaseVersion = releases.getNextReleaseVersion(deployHelper.releaseVersion);

	pg.connect(db.getConnectionString(deployHelper.env), function(err, db, done) {
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
		db.query(txCommands.begin, function(err) {
			if(err) {
				callback(err);
			}

			async.each(releaseFiles, function(filename, callback) {
				let sqlFileContents = files.readFile(filename);

				if(deployHelper.options.verbose || deployHelper.options.dryRun) {
					rarra.info(filename + ':');
					rarra.info('-----------');
					console.log(sqlFileContents);
					rarra.info('');
				}

				if(!deployHelper.options.dryRun) {
					db.query(sqlFileContents, function(err) {
						rarra.info('Deploy ' + filename);
						callback(err)
					});
				} else {
					callback();
				}
			}, function(err) {
				if(err) {
					callback(err);
				}

				db.query(txCommands.commit, function(err) {
					done();
					callback(err);
				});
			});
		});
	});
}