require("@rushstack/eslint-patch/modern-module-resolution")


module.exports = {
	env: {
		node: false,
	},
	extends: [
		'plugin:vue/vue3-essential',
		'@vue/eslint-config-typescript/recommended',
	],
	rules: {
		"vue/require-default-prop": "off",
		// override/add rules settings here, such as:
		// 'vue/no-unused-vars': 'error'
		"@typescript-eslint/no-explicit-any": 0
	}
}