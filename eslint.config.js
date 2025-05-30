// eslint.config.js
import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
	{
		// Add this 'ignores' property to exclude directories/files
		ignores: ['generated/', 'node_modules/'], // Exclude the entire 'generated' directory and 'node_modules'
	},
	{
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		files: ['**/*.js'], // Apply these rules to all .js files that are NOT ignored
		plugins: {
			// No specific plugins for now, as it's a backend Node.js project
		},
		rules: {
			...pluginJs.configs.recommended.rules,

			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			eqeqeq: 'error', // Enforce strict equality (===)
			// 'no-console': 'warn', // Consider this rule, or 'off' during development
			// 'no-debugger': 'error', // Keep this on for production code
			// 'no-trailing-spaces': 'error',
			// 'indent': ['error', 2, { SwitchCase: 1 }], // Example: if you want 2-space indent
		},
	},
];
