'use strict';

const fs = require('fs');
const Mustache = require('mustache');
const rarra = require('./rarra.js');
const mkpath = require('mkpath');
const path = require('path');

let files = {
	readFile(filename) {
		try {
			return fs.readFileSync(filename, 'utf8');
		} catch(err) {
			rarra.error('Can not read ' + filename);
		}
	},

	writeFile(filename, contents) {
		try {
			this.createDir(path.dirname(filename));

			let filePath = process.cwd() + filename;
			return fs.writeFileSync(filePath, contents);
		} catch(err) {
			rarra.warn(err);
			rarra.error('Can not write to ' + filename);
		}
	},

	createDir(dir) {
		mkpath.sync(process.cwd() + dir);
	},

	createFileFromTemplate(filename, template, data) {

		let contents = Mustache.render(this.readFile('./lib/templates/' + template + '.sql'), data);

		this.writeFile(filename, contents);
	},

	getSchemas(directory) {
		return fs.readdirSync(directory).filter((file) => {
			return fs.statSync(directory+'/'+file).isDirectory() && ['releases', '__backups'].indexOf(file) == -1;
		});
	},

	getTables(directory) {

		let schemas = this.getSchemas(directory);
		let tables =  [];

		schemas.forEach((schema) => {
			let tableNames = fs.readdirSync(directory + '/' + schema + '/tables').filter((filename) => {
				return filename.startsWith('create_');
			}).map((filename) => {
				let tableName = filename.replace('create_', '', filename);
				tableName = tableName.replace(/\.v[0-9]{5}\.sql/, '', filename);

				return schema + '.' + tableName;
			});

			tables = tables.concat(tableNames);
		});

		return tables;
	},

	getBackups(directory) {
		return fs.readdirSync(directory + '/__backups').filter((file) => {
			return fs.statSync(directory + '/__backups/' + file).isDirectory();
		});
	},

	getFileStream(filename) {
		this.writeFile(filename, '');
		return fs.createWriteStream(process.cwd() + '/' + filename);
	}
};

module.exports = files;
