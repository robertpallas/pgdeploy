'use strict';

const fs = require('fs');
const Mustache = require('mustache');
const rarra = require('./rarra.js');
const mkpath = require('mkpath');
const path = require('path');

var files = {
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
			console.log(err);
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
		return fs.readdirSync(directory).filter(function (file) {
			return fs.statSync(directory+'/'+file).isDirectory() && file != 'releases';
		});
	}
};

module.exports = files;
