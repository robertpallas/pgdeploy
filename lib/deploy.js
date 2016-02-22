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
			rarra.info(res.env + ' is protected environment.')
			_.unset(deployHelper.options, ['clean', 'generate']);
			deployHelper.options.single = true;
		}

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
					rarra.error('Failed to deploy');
				}

				rarra.success();
			});

		});
	});
}

function checkNextDeploy() {
	// if only one release was supposed to be deployed or the next release has no files stop deploying releases
	return deployHelper.options.single || !releases.getReleaseFiles(deployHelper.releaseVersion).length;
}

function deployRelease(callback) {
	let ver = deployHelper.releaseVersion;
	let releaseFiles = releases.getReleaseFiles(ver);

	rarra.info(releaseFiles.length + ' files in release ' + ver);

	deployHelper.releaseVersion = releases.getNextReleaseVersion(deployHelper.releaseVersion);

	pg.connect(db.getConnectionString(deployHelper.env), function(err, db, done) {
		if(err) {
			callback(err);
		}

		// deploy releases to the database in one transaction
		db.query('begin', function(err){
			if(err) {
				callback(err);
			}

			async.each(releaseFiles, function(filename, callback) {
				db.query(files.readFile(filename), function(err){
					console.log('Deployed ' + filename);
					callback(err)
				})
			}, function(err){
				if(err) {
					callback(err);
				}

				db.query('commit', function(err){
					done();
					callback(err);
				});
			});
		});
	});
}
