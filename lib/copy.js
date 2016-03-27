'use strict';

const pg = require('pg');
const fs = require('fs');
const async = require('async');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const db = require('./db.js');

let copy = {
	withOptions: ' csv header',

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
					done();
					callback();
				});

				fileStream.on('open', () => {
					let sql = 'copy ' + table + ' to stdout' + copy.withOptions;
					let stream = client.query(copyTo(sql));
					stream.pipe(fileStream);
					stream.on('error', () => {
						done();
						callback('Filestream write error');
					});
				});

				fileStream.on('error', () => {
					done();
					callback('Filestream open error');
				});
			});
		}, err => {
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

					copy.checkColumns(tableDataFile, table, client, err => {

						if(err) {
							pgdeploy.warn(err);
							cb();
						} else {
							let sql = 'copy ' + table + ' from stdin' + copy.withOptions;
							let stream = client.query(copyFrom(sql));
							let fileStream = fs.createReadStream(tableDataFile);

							fileStream.pipe(stream).on('error', err => {
								pgdeploy.warn(err);
								pgdeploy.warn('Can not write to ' + table);
								done();
								cb();
							}).on('finish', () => {
								pgdeploy.info(table + ' imported');
								done();
								cb();
							});
						}
					});
				});
			}
		}, err => {
			if(err) {
				pgdeploy.warn(err);
				pgdeploy.error('Failed to import data from backup ' + backup + ' to ' + env);
			}
			callback();
		});
	},

	checkColumns(tableDataFile, table, client, cb) {
		let fileContents = files.readFile(tableDataFile);
		let fileRows = fileContents.split('\n');
		let fileColumns = fileRows[0].split(',');

		let sql = 'select attname from pg_attribute where attrelid = $1::regclass and attnum > 0 and not attisdropped;'
		client.query(sql, [table], (err, res) => {
			if(err) {
				pgdeploy.warn(err);
				pgdeploy.error('Failed to get table data before copying backups');
			}

			let sqlColumns = _.map(res.rows, 'attname');
			if(_.isEqual(sqlColumns, fileColumns)) {
				// db and backup file have same columns
				cb();
			} else {
				pgdeploy.warn(table + ' columns in database and backup file do not match.');
				console.log('Columns in db: ' + sqlColumns);
				console.log('Columns in backup: ' + fileColumns);

				pgdeploy.warn('Please alter the backup file manually or remove it @ ' + tableDataFile);

				/*	TODO: try altering the backup to have same columns as db (in same order)
				if(sqlColumns.length > fileColumns.length) {
					// likely that new columns are added, try adding them in backup with empty values
					let newColumns = _.difference(sqlColumns, fileColumns);

					pgdeploy.info('Trying to add ' + newColumns + ' in backup');

					fileColumns = _.concat(fileColumns, newColumns);

					// insert one , per added column to end of every non-empty row
					fileRows = _.map(fileRows, row => (row) ? row + _.repeat(',', newColumns.length) : '');

					// write updated rows back to backup file
					fileRows[0] = fileColumns.join(',');
					fileContents = fileRows.join('\n');

					files.writeFile(tableDataFile, fileContents);
				}*/

				cb('Will not insert ' + table + ' from backup');
			}
		});
	}
};

module.exports = copy;