'use strict';

const fs = require('fs');
const recursive = require('recursive-readdir-sync');
const async = require('async');
const _ = require('lodash');
const rarra = require('./rarra.js');

var releases = {
	directory: rarra.getConfig().directory,

	getSqlFiles: function() {
		let files;
		try {
			files = recursive(this.directory);
			files = files.filter(this.isFileVersionedSql);
			return files;
		} catch(err) {
			rarra.error('Could not read SQL release files @ ' + this.directory);
		}
	},

	isFileVersionedSql: function(fileName) {
		return /^.*\.v[0-9]{5}\.sql$/.test(fileName);
	},

	getReleaseFiles: function(release) {
		let files = this.getSqlFiles();

		return files.filter(function(el) {
			return el.indexOf(release + '.sql') > -1;
		});
	},

	getReleases: function() {
		let files = this.getSqlFiles();
		return _.sortBy(_.uniq(_.map(files, function(el) {
			let filePieces = _.reverse(_.split(el, '.'));
			return filePieces[1];
		})));
	},

	getLatestRelease: function() {
		let releases = this.getReleases();
		releases = _.reverse(releases);
		return releases[0] || 'v00000';
	},

	getNextReleaseVersion: function(latestRelease) {
		let latestReleaseInt = parseInt(latestRelease.replace(/v0{0,4}/g, ''));
		return 'v' + _.padStart((latestReleaseInt + 1), 5, '0');
	}
};

module.exports = releases;
