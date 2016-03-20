'use strict';

const inquirer = require('inquirer');
const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');

let save = {
	defaultDirection: 'in'
};

module.exports=addFunction;

function addFunction(latestRelease, directory) {

	save.latestRelease = latestRelease;
	save.directory = directory;

	let schemas = files.getSchemas(directory);

	if(!schemas.length) {
		pgdeploy.error('There are no schemas, add a schema first!');
	}

	inquirer.prompt([
		{
			type: 'list',
			name: 'schema',
			message: 'Schema',
			choices: schemas
		},
		{
			type: 'input',
			name: 'function',
			message: 'Function name',
			validate(str) {
				return str.length && /^[A-Za-z_]*$/.test(str);
			},
			filter(str) {
				return str.toLowerCase();
			}
		}
	], askParams);
}

function askParams(res) {
	pgdeploy.info('Give me parameters one by one');

	inquirer.prompt([
		{
			type: 'list',
			name: 'direction',
			message: 'Parameter type',
			choices: ['in', 'out'],
			default: save.defaultDirection
		},
		{
			type: 'input',
			name: 'name',
			message: 'Parameter name',
			validate(str) {
				return str.length && /^[A-Za-z_]*$/.test(str);
			},
			filter(str) {
				return str.toLowerCase();
			}
		},
		{
			type: 'list',
			name: 'type',
			message: 'Parameter type',
			choices: db.dataTypes
		},
		{
			type: 'confirm',
			name: 'addMore',
			message: 'Add more params?',
			default: true
		}
	], paramRes => {
		save.defaultDirection = paramRes.direction;

		if(!res.params) {
			res.params = [];
		}

		paramRes.in = paramRes.direction === 'in'; // for input var names list in function template
		res.params.push(paramRes);

		if (paramRes.addMore) {
			askParams(res);
		} else {
			res.params[res.params.length - 1].last = true; // for coma placement in template

			res.functionFilename = '/' + save.directory + '/' + res.schema + '/functions/' + res.function + '.' + save.latestRelease + '.sql';
			pgdeploy.info('New file: ' + res.functionFilename);

			files.createFileFromTemplate(res.functionFilename, 'create_function.sql', res);

			// amount of input params
			res.inParams = res.params.filter(param => param.in);
			let paramPlaces = Array(res.inParams.length).fill().map((el,index)=>'$'+(index+1));
			res.paramPlaces = paramPlaces.join(', ');
			res.paramNames = res.inParams.map(el=>el.name).join(', ');

			let testFilename = '/' + save.directory + '/' + res.schema + '/tests/test_' + res.function + '.js';
			pgdeploy.info('New file: ' + testFilename);
			files.createFileFromTemplate(testFilename, 'test.template', res);

			pgdeploy.info('Function ' + res.schema + '.' + res.function + ' added');
		}
	});
}
