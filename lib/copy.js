'use strict';

const pg = require('pg');
const fs = require('fs');
const async = require('async');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

const rarra = require('./rarra.js');
const files = require('./files.js');
const db = require('./db.js');

var copy = {
	fromDb(env, directory) {

		let tables = files.getTables(process.cwd() + '/' + rarra.getConfig().directory);

		async.each(tables, function(table, callback) {

			pg.connect(db.getConnectionString(env), function(err, client, done) {
				if(err) {
					rarra.warn(err);
					rarra.error('Failed to connect for data export');
				}

				let fileStream = files.getFileStream(directory + '/' + table);
				fileStream.on('finish', () => {
					rarra.info(table + ' data copied');
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
		}, function(err) {
			if(err) {
				rarra.warn(err);
				rarra.error('Failed to export data from tables');
			}
			rarra.success('All files done');
		});
	},


	toDb(env, backup) {

		let tables = files.getTables(process.cwd() + '/' + rarra.getConfig().directory);

		async.each(tables, function(table, callback) {

			let tableDataFile = process.cwd() + '/' + rarra.getConfig().directory + '/__backups/' + backup + '/' + table;

			if(!fs.existsSync(tableDataFile)) {
				rarra.warn(tableDataFile + ' does not exist.');
				callback();
			} else {
				pg.connect(db.getConnectionString(env), function(err, client, done) {
					if(err) {
						rarra.warn(err);
						rarra.error('Failed to connect for data import');
					}

					let stream = client.query(copyFrom('COPY ' + table + ' FROM STDIN'));
					let fileStream = fs.createReadStream(tableDataFile);

					fileStream.pipe(stream).on('error', (err) => {
						rarra.warn('Can not write to ' + table);
						done();
						callback();
					}).on('finish', () => {
						rarra.info(table + ' imported');
						done();
						callback();
					});
				});
			}
		}, function(err) {
			if(err) {
				rarra.warn(err);
				rarra.error('Failed to import data from backup ' + backup + ' to ' + env);
			}
			rarra.success('All found files done');
		});
	}
};

module.exports = copy;