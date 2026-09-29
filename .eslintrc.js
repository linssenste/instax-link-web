require("@rushstack/eslint-patch/modern-module-resolution")


module.exports = {
	env: {
		node: false,
	},
	extends: [
		'plugin:vue/vue3-essential',
		'plugin:vuejs-accessibility/recommended',
		'@vue/eslint-config-typescript/recommended',
	],
	rules: {
		"vue/require-default-prop": "off",
		"@typescript-eslint/no-explicit-any": "error"
	},
	overrides: [
		{
			// test doubles stand in for third party objects, where the shape is
			// not worth restating
			files: ["src/**/__tests__/**"],
			rules: {
				"@typescript-eslint/no-explicit-any": "off"
			}
		}
	]
}