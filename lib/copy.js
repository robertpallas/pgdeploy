'use strict';

const pg = require('pg');
const fs = require('fs');
const async = require('async');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const db = require('./db.js');

let copy = {
	fromDb(env, directory) {

		let tables = files.getTables(process.cwd() + '/' + pgdeploy.getConfig().directory);

		async.each(tables, (table, callback) => {

			pg.connect(db.getConnectionString(env), (err, client, done) => {
				if(err) {
					pgdeploy.warn(err);
					pgdeploy.error('Failed to connect for data export');
				}

				let fileStream = files.getFileStream(directory + '/' + table);
				fileStream.on('finish', () => {
					pgdeploy.info(table + ' data copied');
					callback();
				});
				fileStream.on('open', () => {
					var stream = client.query(copyTo('COPY ' + table + ' TO STDOUT'));
					stream.pipe(fileStream);
					stream.on('end', done);
					stream.on('error', () => {
						done();
						callback('Filestream error');
					});
				});

			});
		}, (err) => {
			if(err) {
				pgdeploy.warn(err);
				pgdeploy.error('Failed to export data from tables');
			}
			pgdeploy.success('All files done');
		});
	},


	toDb(env, backup, callback) {

		let tables = files.getTables(process.cwd() + '/' + pgdeploy.getConfig().directory);

		async.each(tables, (table, cb) => {

			let tableDataFile = process.cwd() + '/' + pgdeploy.getConfig().directory + '/__backups/' + backup + '/' + table;

			if(!fs.existsSync(tableDataFile)) {
				pgdeploy.warn(tableDataFile + ' does not exist.');
				cb();
			} else {
				pg.connect(db.getConnectionString(env), (err, client, done) => {
					if(err) {
						pgdeploy.warn(err);
						pgdeploy.error('Failed to connect for data import');
					}

					let stream = client.query(copyFrom('COPY ' + table + ' FROM STDIN'));
					let fileStream = fs.createReadStream(tableDataFile);

					fileStream.pipe(stream).on('error', (err) => {
						pgdeploy.warn(err);
						pgdeploy.warn('Can not write to ' + table);
						done();
						cb();
					}).on('finish', () => {
						pgdeploy.info(table + ' imported');
						done();
						cb();
					});
				});
			}
		}, (err) => {
			if(err) {
				pgdeploy.warn(err);
				pgdeploy.error('Failed to import data from backup ' + backup + ' to ' + env);
			}
			callback();
		});
	}
};

module.exports = copy;