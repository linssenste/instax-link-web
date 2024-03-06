<template>
	<div class="status-card">
		<div class="image-status">

			<!-- image to be printed -->
			<img :src="element.base64" draggable="false" height="90" />

			<div class="image-status-info">

				<div class="status-text" data-testid="status-text">
					<span v-if="element.state > 0 && isCanceling == true">CANCELING...</span>
					<span v-else-if="element.state == 0">IN QUEUE</span>
					<span v-else-if="element.state == 1">SENDING ...</span>
					<span v-else-if="element.state == 2">PRINTING
						<span>
							{{ Math.round(element.progress / (100 / element.quantity)) }}/{{ element.quantity }}
						</span>
					</span>

					<!-- remove/cancel button -->
					<button data-testid="canceling-button" class="remove-button" :class="isCanceling ? 'disabled' : ''"
							v-on:click="cancelPrinting()">
						<img src="@/assets/icons/controls/xmark.svg" width="12" />
					</button>
				</div>


				<div v-if="element.state < 2" class="print-quantity" data-testid="quantity-setter">

					<!-- decrease input -->
					<button data-testid="quantity-button-minus" v-on:click="modifyQuantity(element.quantity - 1)"
							:class="element.quantity <= 1 ? 'disabled' : ''" class="quantity-icon-button">
						<img src="@/assets/icons/printer/minus.svg" draggable="false" width="12" />

					</button>


					<input data-testid="quantity-input-field" v-model="quantityInput" v-on:keyup.enter="verifyQuantityInput"
						   v-on:blur="verifyQuantityInput" class="quantity-input" type="number" pattern="\d*" :min="1"
						   :max="10" />

					<!-- increase button -->
					<button data-testid="quantity-button-plus" v-on:click="modifyQuantity(element.quantity + 1)"
							:class="element.quantity >= 10 ? 'disabled' : ''" class="quantity-icon-button">
						<img src="@/assets/icons/printer/plus.svg" draggable="false" width="12" />
					</button>


				</div>
			</div>
		</div>


		<!-- printing progress bar  -->
		<div v-if="element.state > 0" class="printing-status-progress" data-testid="printing-progress">

			<div class="progress-bar" data-testid="printing-progress-sending">
				<div v-if="element.state >= 1" class="progress"
					 :style="`width: ${element.state == 2 ? 100 : element.progress}%`" />
			</div>

			<div data-testid="printing-progress-step" class="progress-step"
				 :style="element.state != 2 ? 'background-color: var(--light-grey-color)!important' : ''" />

			<div data-testid="printing-progress-printing" class="progress-bar">
				<div v-if="element.state == 2" id="printProgress" class="progress progress-print"
					 :style="`min-width: 10px; width: ${element.progress}%`" />
			</div>
		</div>

	</div>
</template>


<script lang="ts" setup>
import { ref, watch } from 'vue';
import { QueueImage } from '../../interfaces/QueueImage';

const emit = defineEmits(['cancel', 'quantity-change'])

const props = defineProps<{
	element: QueueImage;
}>();

props.element;

const quantityInput = ref(props.element.quantity ?? 1);
const isCanceling = ref(false);


watch(quantityInput, () => modifyQuantity(quantityInput.value));

watch(() => props.element.quantity, () => {
	let quanValue = props.element.quantity;
	if (quanValue > 10) quanValue = 10;
	// else if (quanValue <= 0) quanValue = 1;

	quantityInput.value = quanValue;
})

function verifyQuantityInput(): void {
	if (quantityInput.value <= 1) quantityInput.value = 1
	if (quantityInput.value > 10) quantityInput.value = 10;

	(document.activeElement as HTMLInputElement)?.blur()
}
function cancelPrinting(): void {
	isCanceling.value = true;
	emit('cancel')
}

function modifyQuantity(value: number): void {
	emit('quantity-change', value)
}
</script>


<style scoped>
.progress-bar {
	background-color: var(--light-grey-color);
	width: calc(100%/2);
	height: 10px;

	border-radius: 5px
}

.progress {

	/* background-color: red; */
	border-radius: 5px;
	min-width: 10px;
	height: 10px;
	position: relative;
	overflow: hidden;
	background-color: var(--dynamic-bg-color);

}

.progress-print {
	transition: width 15s linear;
	background-color: var(--dynamic-bg-color) !important;
}


.progress-step {

	background-color: var(--dynamic-bg-color);

	width: 12px !important;
	height: 10px !important;
	margin-left: 5px;
	border-radius: 50%;
	margin-right: 5px;
}

.print-quantity {
	display: flex;
	flex-direction: row;
	align-items: center;
}


.quantity-icon-button {
	position: relative;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background-color: var(--dynamic-bg-color);
	opacity: .75;
	transition: opacity 150ms ease-in-out;
}

.quantity-icon-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	opacity: .9;
}


.disabled {
	opacity: .3 !important;
	cursor: not-allowed !important;
	pointer-events: none;
}

.quantity-icon-button:hover img {
	opacity: 1;
}

.quantity-icon-button:hover {
	opacity: 1;
	box-shadow: 0px 0px 5px rgba(0, 0, 0, .05);

}

.quantity-input {
	height: 32px;
	outline: none;
	border: none;
	font-size: 15px;
	text-align: CENTER;
	width: 40px;
	border-radius: 5px;
	margin-left: 5px;
	margin-right: 5px;
	background-color: var(--light-grey-color);
	opacity: .75;
	transition: opacity 150ms ease-in-out;
}

.quantity-input:hover {
	opacity: 1;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
	/* display: none; <- Crashes Chrome on hover */
	-webkit-appearance: none;
	margin: 0;
	/* <-- Apparently some margin are still there even though it's hidden */
}

/* input[type=number] {
	: textfield;
} */


.status-card {
	position: relative;
	background-color: #fafafacc;
	border-radius: 10px;
	padding: 10px;
	margin-top: 15px;
	transition: all 150ms ease-in-out;
}

.status-card:hover {
	background-color: #fafafacc;
}

.image-status {
	display: flex;
	flex-direction: row;
	align-items: start;
	gap: 20px
}

.image-status img {
	border-radius: 8px;
}

.image-status-info {
	width: calc(100% - 60px);
	display: flex;
	flex-direction: column;
	align-items: start;
	justify-content: start;
	height: 80px;
	gap: 15px;
	position: relative;
}

.status-text {
	color: #a0a0a0;
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	justify-content: space-between;
}

.remove-button {
	background-color: #e0e0e0;
	width: 32px;
	height: 32px;
	position: relative;
	border-radius: 50%;
	opacity: .75;
}

.remove-button:hover {
	opacity: 1;
}

.remove-button img {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}


.printing-status-progress {
	position: relative;
	width: 100%;
	display: flex;
	flex-direction: row;
	margin-top: 10px;
}
</style>