import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Read one CSS rule out of a component's source.
 *
 * jsdom applies no scoped styles, so anything about layout or colour has to be
 * checked in the source. Slicing on `indexOf(selector + ' {')` looks like it works
 * and then quietly returns the wrong rule: a selector appears again inside its
 * grouped rule (`.a,\n.b {`) and inside any nested one (`.panel > .b {`), and a
 * `v-bind()` interpolation carries a closing brace of its own. So the lines are
 * walked instead, and only a selector standing on its own counts.
 */
export function cssOf(path: string): (selector: string) => string {
	const lines = readFileSync(resolve(process.cwd(), path), 'utf8').split('\n')

	return (selector: string) => {
		const head = `${selector} {`.split('\n')

		const start = lines.findIndex((line, index) =>
			head.every((wanted, offset) => lines[index + offset] === wanted)
			// a grouped rule puts the selector after a comma on the line before
			&& !(lines[index - 1] ?? '').trimEnd().endsWith(',')
		)

		if (start < 0) throw new Error(`${selector} was not found on its own in ${path}`)

		const end = lines.findIndex((line, index) => index > start && line === '}')
		return lines.slice(start, end < 0 ? undefined : end).join('\n')
	}
}

/** the whole file, for the odd check that is not about one rule */
export const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
