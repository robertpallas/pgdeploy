'use strict';

const pg = require('pg');
const pgdeploy = require('./pgdeploy.js');

const dataTypes = ['text', 'boolean', 'timestamptz', 'bigint', 'numeric', 'interval', 'json', 'uuid'];

let db = {

	dataTypes,

	getConnectionString(env) {
		let envConfig = pgdeploy.getConfig().environments[env];
		return 'pg://' + envConfig.username + ':' + envConfig.password + '@' + envConfig.host + '/' + envConfig.database;
	},

	query(env, sql, data, callback) {
		pg.connect(db.getConnectionString(env), (err, client, done) => {
			if(err) {
				callback(err, null);
			} else {
				client.query(sql, data, (err, result) => {
					done();
					callback(err, result);
				});
			}
		});
	},

	getAllReleases(env, callback) {
		this.query(env, 'select * from releases.releases order by id desc', [], (err, result) => {
			if(!err) {
				callback(null, result.rows);
			} else {
				pgdeploy.warn(err);
				callback('Failed to get releases for ' + env, null);
			}
		});

	},

	getLastReleaseVersion(env, callback) {
		this.query(env, 'select version from releases.releases order by id desc limit 1', [], (err, result) => {
			if(!err) {
				let lastReleaseVersion = (result.rows && result.rows[0] && result.rows[0].version)?result.rows[0].version : null;
				if(lastReleaseVersion) {
					pgdeploy.info('Last release on ' + env + ' is ' + lastReleaseVersion);
				} else {
					pgdeploy.info('There are no releases on ' + env);
				}

				callback(null, lastReleaseVersion);
			} else {
				pgdeploy.warn(err);
				callback('Failed to get last release version for ' + env, null);
			}
		});
	},

	init(env, callback) {
		this.query(env, 'create schema if not exists releases', [], (err, result) => {

			if(err) {
				callback('Could not create releases schema for ' + env);
			}

			let sql = 'create table if not exists releases.releases(id serial, version text unique, released_by text, created_at timestamptz, description text)';
			db.query(env, sql, [], (err, result) => {

				if(err) {
					callback('Could not create releases table for ' + env);
				}

				pgdeploy.info('Database initialized for environment ' + env);
				callback();
			});
		});
	}
};

module.exports = db;