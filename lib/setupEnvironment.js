'use strict';

const inquirer = require('inquirer');
const pg = require('pg');
const rarra = require('./rarra.js');

module.exports=setupEnvironment;

function setupEnvironment(env, callback) {

	inquirer.prompt([
		{
			type: 'input',
			name: 'host',
			message: '[' + env.toUpperCase() + '] PostgreSQL host location with port number',
			default: 'localhost:5432'
		},
		{
			type: 'input',
			name: 'username',
			message: '[' + env.toUpperCase() + '] Username'
		},
		{
			type: 'password',
			name: 'password',
			message: '[' + env.toUpperCase() + '] Password'
		},
		{
			type: 'input',
			name: 'database',
			message: '[' + env.toUpperCase() + '] Database'
		},
		{
			type: 'confirm',
			name: 'protected',
			message: 'Protected from cleanup and test data generation?',
			default: true
		}
	], function(res) {
		let db = new pg.Client('postgres://'+res.username+':'+res.password+'@'+res.host+'/'+res.database);
		db.connect(function(err){

			if(err) {
				callback('Could not connect to the database ' + env + ' @ ' + res.host);
			} else {

				db.query('create schema if not exists releases', function(err, result){

					if(err) {
						callback('Could not create releases schema for ' + env);
					}

					let sql = 'create table if not exists releases.releases(id serial, version text unique, released_by text, creation_time timestamptz, description text)';
					db.query(sql, function(err, result){

						if(err) {
							callback('Could not create releases table for ' + env);
						}

						let config = rarra.getConfig();
						config.environments[env] = res;
						rarra.setConfig(config);

						rarra.info('Database initialized for environment ' + env);
						callback();
					});
				});
			}
		})
	});
}
