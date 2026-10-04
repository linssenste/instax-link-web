<template>
	<div>
		<div oncontextmenu="return false" class="size-selector" role="group" aria-label="Polaroid film size">
			<button v-for="filmType in FILM_VARIANTS" :key="filmType" type="button" :title="polaroidTitle(filmType)"
				:style="polaroidClass(filmType)" :aria-label="polaroidTitle(filmType)"
				:aria-pressed="selectedType === filmType" @click="selectedType = filmType" class="polaroid"
				:data-testid="`polaroid-selector-${filmType}`">

				<!-- inner polaroid develops (fade-in) and shows random image if selected -->
				<div class="inner-polaroid">
					<img v-show="selectedType === filmType" v-on:load="beginImageDevelopment"
						referrerpolicy="no-referrer" crossorigin="anonymous"
						v-on:error="setFallbackImage($event, filmType)" :src="randomPolaroidImage(filmType)"
						:data-testid="`image-${filmType}`" alt="random miniature image" width="100%" height="100%" />

					<div class="overlay" :id="`${filmType}-overlay`"></div>
				</div>
			</button>

		</div>


		<div class="info-text">
			TYPE: <b>{{ selectedType.toUpperCase() }}</b>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { InstaxFilmVariant } from '../../interfaces/PrinterStateConfig';

const FILM_VARIANTS = [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.WIDE];

const storedType = localStorage.getItem('polaroid') as InstaxFilmVariant | null;
const selectedType = ref<InstaxFilmVariant>(
	storedType != null && FILM_VARIANTS.includes(storedType) ? storedType : InstaxFilmVariant.SQUARE
);

// events
const emit = defineEmits<{

	/**
	 * emits new selected type (mini, square or wide)
	 * @param {InstaxFilmVariant} type new polaroid size type
	 */
	(e: 'type-change', type: InstaxFilmVariant): void;
}>();


// emit change event
watch(selectedType, () => {
	emit('type-change', selectedType.value);
	localStorage.setItem("polaroid", selectedType.value);
}, { immediate: true });


// hovering html title
const polaroidTitle = (filmType: InstaxFilmVariant) => {
	switch (filmType) {
		case InstaxFilmVariant.MINI: return "Instax Mini (600x800)"
		case InstaxFilmVariant.SQUARE: return "Instax Square (800x800)"
		case InstaxFilmVariant.WIDE: return "Instax Wide (1260x840)"
		default: break;
	}
}

const imageHeight = 40

const imageWidth = (filmType: InstaxFilmVariant) => {
	return (filmType == InstaxFilmVariant.MINI ? (3 / 4) : (filmType == InstaxFilmVariant.SQUARE ? 1 : (3 / 2))) * imageHeight;
}

// styling
const polaroidClass = (filmType: InstaxFilmVariant) => {
	return {
		width: `${imageWidth(filmType)}px`,
		boxShadow: `0px 0px 5px rgba(0, 0, 0, ${filmType === selectedType.value ? .5 : .25})`,
		transform: filmType === selectedType.value ? 'scale(1.15)' : "",
	}
}

// set fallback image (dog jasper) if image loading fails
function setFallbackImage(e: Event, filmType: InstaxFilmVariant) {
	if (filmType !== selectedType.value) return;


	const target = e.target as HTMLImageElement; 
	if (!target) return;
	target.src = `/public/fallback-images/fallback-${selectedType.value.charAt(0)}.webp`; 
	beginImageDevelopment()

}

// start image development on selected polaroid after image loaded (fade-out overlay)
function beginImageDevelopment() { 
	const overlay = document.getElementById(`${selectedType.value}-overlay`) as HTMLElement;

	
	if (overlay) {
		overlay.classList.add('develop-polaroid');
	}
}

// generate random image for selected polaroid
function randomPolaroidImage(filmType: InstaxFilmVariant) {
	return filmType == selectedType.value ? `https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/${imageWidth(filmType) * 2}/${imageHeight * 2}` : '';
}

// remove overlay on previous polaroid
watch(selectedType, (newType, oldType) => {
	const overlay = document.getElementById(`${oldType}-overlay`) as HTMLElement;
	if (overlay) {
		overlay.classList.remove('develop-polaroid');
	}
}, { immediate: true });




</script>

<style scoped>
.polaroid {
	position: relative;
	box-sizing: content-box;
	padding: 3px;
	height: 42px;
	padding-top: 4px;
	border-radius: 2px;
	cursor: pointer;
	background-color: rgb(var(--white-color));
	transition: transform 250ms;
	border: none;
	padding-bottom: 12px;
	opacity: 1;
	display: block;
}

.polaroid:focus-visible {
	outline: 2px solid rgb(var(--dynamic-bg-color));
	outline-offset: 2px;
}

.polaroid img {
	margin-right: 0;
}

.inner-polaroid {
	position: relative;
	width: 100%;
	height: 40px;
	background-size: cover;
	background-position: center;
	border-radius: 0;
	border-radius: 1px;
	background-color: rgb(var(--grey-color));
	overflow: hidden;
}

.inner-polaroid>.overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgb(var(--black-color)) !important;
	opacity: 1;
}


.inner-polaroid>.overlay.develop-polaroid {

	transition: opacity 1s;
	opacity: 0;
}

.polaroid:hover {
	transform: scale(1.05);
	box-shadow: 0px 0px 5px rgba(0, 0, 0, .1)
}


.size-selector {
	position: relative;
	display: flex;
	flex-direction: row;
	gap: 13px;
	justify-content: center;
}


.info-text {
	position: relative;
	margin-top: 12px;
	width: 100%;
	font-size: 15px;
	color: rgb(var(--black-color));
}


@media (max-width: 1000px) {
	.size-selector {

		transform: scale(1.25);
	}

	.info-text {
		margin-top: 25px;
		font-size: 17px;


	}
}
</style>