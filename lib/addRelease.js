'use strict';

const rarra = require('./rarra.js');
const files = require('./files.js');
const releases = require('./releases.js');
const _ = require('lodash');

module.exports=addRelease;

function addRelease(latestRelease, directory) {

	let data = {
		version: releases.getNextReleaseVersion(latestRelease),
		released_by: rarra.getUser()
	};

	let filename = '/' + directory + '/releases/insert_release.' + data.version + '.sql';
	rarra.info('New file: ' + filename);

	files.createFileFromTemplate(filename, 'insert_release', data);

	rarra.info('Release ' + data.version + ' added');
}
