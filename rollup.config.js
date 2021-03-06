import globals from 'rollup-plugin-node-globals';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import minify from 'rollup-plugin-babel-minify';
import json from 'rollup-plugin-json';
import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';

const plugins = [
	eslint({
		exclude:      ['**/*.json', 'node_modules/**'],
		throwOnError: process.env.ROLLUP_WATCH != 'true'
	}),
	json({
		preferConst: true
	}),
	babel(Object.assign({
		runtimeHelpers: true,
		babelrc:        false,
		exclude:        'node_modules/**'
	}, pkg.babel, {
		presets: pkg.babel.presets.map((preset) => {

			if (Array.isArray(preset) && preset[0] == 'env') {
				preset[1].modules = false;
			}

			return preset;
		})
	})),
	resolve({
		browser:        true,
		preferBuiltins: false
	}),
	commonjs(),
	globals()
];

const dependencies = Object.keys(pkg.dependencies);

function external(id) {
	return dependencies.some(_ =>
		_ == id || id.indexOf(`${_}/`) == 0
	);
}

export default [{
	input:  'src/index.js',
	plugins,
	external,
	output: [{
		file:      pkg.main,
		format:    'cjs',
		sourcemap: true
	}, {
		file:      pkg.module,
		format:    'es',
		sourcemap: true
	}]
}, {
	input:   'src/index.js',
	plugins: [...plugins, minify()],
	output:  {
		file:      pkg.umd,
		format:    'umd',
		name:      'i18n',
		sourcemap: true
	}
}, {
	input:  'src/middleware.js',
	plugins,
	external,
	output: [{
		file:      'lib/middleware.js',
		format:    'cjs',
		sourcemap: true
	}]
}];
