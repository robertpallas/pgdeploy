'use strict';

const pg = require('pg');
const rarra = require('./rarra.js');

var db = {

	getConnectionString: function(env) {
		let envConfig = rarra.getConfig().environments[env];
		return 'pg://' + envConfig.username + ':' + envConfig.password + '@' + envConfig.host + '/' + envConfig.database;
	},

	query: function(env, sql, callback) {
		pg.connect(db.getConnectionString(env), function(err, db, done) {
			if(err) {
				callback(err, null);
			} else {
				db.query(sql, [], function(err, result){
					done();
					callback(err, result);
				});
			}
		});
	},

	getAllReleases: function(env, callback) {
		this.query(env, 'select * from releases.releases order by id desc', function(err, result) {
			if(!err) {
				callback(null, result.rows);
			} else {
				console.log(err);
				callback('Failed to get releases for ' + env, null);
			}
		});

	},

	getLastReleaseVersion: function(env, callback) {
		this.query(env, 'select version from releases.releases order by id desc limit 1', function(err, result) {
			if(!err) {
				callback(null, (result.rows && result.rows[0] && result.rows[0].version)?result.rows[0].version : null);
			} else {
				console.log(err);
				callback('Failed to get last release version for ' + env, null);
			}
		});
	}
};

module.exports = db;