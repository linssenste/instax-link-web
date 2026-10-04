/**
 * Picking a JPEG quality for the printer.
 *
 * The printer decodes baseline JPEG and nothing else, and the transfer packs the
 * payload length into a uint16 (`instax.ts`), so the file has to come in under
 * 64k however it is encoded. That leaves quality-per-byte as the only thing worth
 * tuning, and how many encodes it takes to get there.
 *
 * Two things this does differently to a plain binary search over quality:
 *
 * - It aims for a quality that looks right rather than for one that fills the
 *   budget. A photo that is visually transparent at 38kB used to be pushed up to
 *   the full 60kB, and those extra bytes are pure transfer time on a link that
 *   sends a couple of hundred bytes at a time.
 * - When the budget is genuinely the constraint, it interpolates instead of
 *   bisecting. JPEG size against quality is smooth and monotone, so two measured
 *   points predict the crossing far better than halving an interval does.
 */

export type Encode = (quality: number) => Promise<Blob>

/**
 * The quality every image is tried at first.
 *
 * Instax film is soft enough that the emulsion, not the encoder, is the limit
 * here; 0.85 sits above where artefacts become visible at print resolution while
 * still landing most photos well under the budget.
 */
export const TARGET_QUALITY = 0.85

/** Below this the image is not worth printing, so the search gives up instead. */
export const MIN_QUALITY = 0.3

/** How many encodes the search may spend before it settles for what it has. */
export const MAX_ATTEMPTS = 5

/**
 * Once a fitting encode is within this much of the budget there is no useful
 * quality left to win, so the search stops rather than spending another encode.
 */
const CLOSE_ENOUGH = 0.9

/**
 * How steeply size falls off with quality, used only for the first step of a
 * search, before there are two real measurements to fit against.
 */
const ASSUMED_EXPONENT = 4

export interface QualitySearch {
	blob: Blob
	quality: number
	attempts: number
}

interface Probe {
	quality: number
	size: number
}

/**
 * Where the budget is likely to be crossed, given what has been measured so far.
 *
 * With a point either side it fits `size = k * quality ^ n` through them and
 * solves for the budget. With only the overshooting side it steps down by an
 * assumed exponent. Either way the answer is kept strictly inside the bracket, so
 * a bad prediction costs one encode rather than stalling the search.
 */
function predict(fits: Probe | null, overshoots: Probe, budget: number, floor: number): number {
	const upper = overshoots.quality
	const lower = fits?.quality ?? floor

	let guess: number

	if (fits != null && fits.size > 0 && overshoots.size > fits.size) {
		const exponent = Math.log(overshoots.size / fits.size) / Math.log(upper / lower)
		guess = Number.isFinite(exponent) && exponent > 0
			? lower * Math.pow(budget / fits.size, 1 / exponent)
			: (lower + upper) / 2
	} else {
		guess = upper * Math.pow(budget / overshoots.size, 1 / ASSUMED_EXPONENT)
	}

	if (!Number.isFinite(guess) || guess <= lower || guess >= upper) guess = (lower + upper) / 2

	// keep it off the ends of the bracket, or a stubborn prediction repeats itself
	const margin = (upper - lower) * 0.05
	return Math.min(Math.max(guess, lower + margin), upper - margin)
}

/**
 * Encode at the best quality that fits the budget.
 *
 * The common case is one encode: an image that is already under budget at
 * {@link TARGET_QUALITY} is sent as it is, small. Only when that overshoots does
 * the search run, and then it is looking for the most quality the budget allows.
 *
 * Returns null when even {@link MIN_QUALITY} will not fit, which the caller
 * reports rather than sending something the printer would reject.
 */
export async function encodeWithinBudget(
	encode: Encode,
	budget: number,
	hint?: number
): Promise<QualitySearch | null> {
	let attempts = 0

	const attempt = async (quality: number): Promise<Probe & { blob: Blob }> => {
		attempts++
		const blob = await encode(quality)
		return { quality, size: blob.size, blob }
	}

	const first = await attempt(TARGET_QUALITY)
	if (first.size <= budget) return { blob: first.blob, quality: first.quality, attempts }

	// the budget is the constraint after all, so now find the most quality it buys
	let overshoots: Probe = first
	let fits: Probe | null = null
	let best: QualitySearch | null = null

	// the quality the previous image needed is a better opening guess than an
	// interpolation from a single point, and costs nothing when it is wrong
	let next = hint != null && hint > MIN_QUALITY && hint < overshoots.quality
		? hint
		: predict(null, overshoots, budget, MIN_QUALITY)

	while (attempts < MAX_ATTEMPTS) {
		const probe = await attempt(next)

		if (probe.size <= budget) {
			fits = probe
			best = { blob: probe.blob, quality: probe.quality, attempts }
			if (probe.size >= budget * CLOSE_ENOUGH) break
		} else {
			overshoots = probe
		}

		if (overshoots.quality - (fits?.quality ?? MIN_QUALITY) < 0.01) break
		next = predict(fits, overshoots, budget, MIN_QUALITY)
	}

	// the count is whatever the search ended up spending, not what it had spent
	// when this candidate happened to come up
	if (best != null) return { ...best, attempts }

	// nothing has fitted yet, so spend the last encode on the one quality that
	// still might rather than on another guess between the two that did not
	const last = await attempt(MIN_QUALITY)
	return last.size <= budget ? { blob: last.blob, quality: last.quality, attempts } : null
}
