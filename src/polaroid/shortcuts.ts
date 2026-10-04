/**
 * The keyboard for the editor.
 *
 * Plain letters and arrows, with Shift as the only modifier, so one set of keys
 * works the same on macOS, Windows and Linux: nothing here collides with a browser
 * or system shortcut, and there is no Cmd/Ctrl split to remember. The labels are
 * written out here too, so a button's tooltip and this table cannot drift apart.
 */
export interface Shortcut {
	/** shown after the button's own name */
	hint: string
	/** how to describe it in a list of shortcuts */
	description: string
}

export const SHORTCUTS = {
	fitWidth: { hint: 'W', description: 'Fit the image to the frame width' },
	fitHeight: { hint: 'H', description: 'Fit the image to the frame height' },
	centreHorizontally: { hint: 'C', description: 'Centre the image horizontally' },
	centreVertically: { hint: 'Shift C', description: 'Centre the image vertically' },
	rotate: { hint: 'R', description: 'Turn the image a quarter clockwise' },
	rotateBack: { hint: 'Shift R', description: 'Turn the image a quarter anticlockwise' },
	filmLook: { hint: 'F', description: 'Open the film look' },
	settings: { hint: 'S', description: 'Show or hide the image settings' },
	move: { hint: 'Arrows', description: 'Move the image, ten times as far with Shift' }
} as const satisfies Record<string, Shortcut>

/** how far an arrow moves the image, and how far it moves with Shift held */
export const NUDGE_STEP = 1
export const NUDGE_STRIDE = 10

/** a quarter turn, matching the dial's own anchors */
export const ROTATE_STEP = 90

export type EditorCommand =
	| { kind: 'move', x: number, y: number }
	| { kind: 'fit', horizontal: boolean }
	| { kind: 'centre', horizontal: boolean }
	| { kind: 'rotate', degrees: number }
	| { kind: 'film' }
	| { kind: 'settings' }

const ARROWS: Record<string, { x: number, y: number }> = {
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 }
}

/** a field the keys belong to rather than to the editor */
function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	return target.isContentEditable
		|| ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Which command a key press asks for, or null where it asks for nothing.
 *
 * Anything held with Ctrl, Cmd or Alt is left alone, so the browser and the system
 * keep their own shortcuts; so is anything typed into a field, and anything a
 * focused control has already dealt with, which is how the rotation dial keeps the
 * arrow keys for its own finer steps.
 */
export function commandFor(event: KeyboardEvent): EditorCommand | null {
	if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
	if (isTyping(event.target)) return null;

	const arrow = ARROWS[event.key];
	if (arrow != null) {
		const step = event.shiftKey ? NUDGE_STRIDE : NUDGE_STEP;
		return { kind: 'move', x: arrow.x * step, y: arrow.y * step };
	}

	switch (event.key.toLowerCase()) {
		case 'w': return { kind: 'fit', horizontal: true };
		case 'h': return { kind: 'fit', horizontal: false };
		case 'c': return { kind: 'centre', horizontal: !event.shiftKey };
		case 'r': return { kind: 'rotate', degrees: event.shiftKey ? -ROTATE_STEP : ROTATE_STEP };
		case 'f': return { kind: 'film' };
		case 's': return { kind: 'settings' };
		default: return null;
	}
}

/** a button's tooltip with its shortcut after it */
export const titleWith = (label: string, shortcut: Shortcut) => `${label} (${shortcut.hint})`
