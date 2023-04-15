<template>
    <div class="ml-0 d-flex flex-row align-center">

        <div v-on:click="selectedColor='black'" :class="selectedColor==='black'? 'color-selector-item-selected':''"
            data-testid="black-color-selector-item" class="color-selector-item bg-black rounded-pill mr-2"></div>

        <div v-on:click="selectedColor='white'" :class="selectedColor==='white'? 'color-selector-item-selected':''"
            data-testid="white-color-selector-item" class="color-selector-item bg-grey-lighten-3 rounded-pill mr-2"></div>
        <div v-on:click="selectedColor='pink'" :class="selectedColor==='pink'? 'color-selector-item-selected':''"
            data-testid="pink-color-selector-item" class="color-selector-item bg-pink rounded-pill mr-2">

        </div>
        <div v-on:click="selectedColor='red'" :class="selectedColor==='red'? 'color-selector-item-selected':''"
            data-testid="red-color-selector-item" class="color-selector-item bg-red rounded-pill mr-2"></div>
        <div v-on:click="selectedColor='orange'" :class="selectedColor==='orange'? 'color-selector-item-selected':''"
            data-testid="orange-color-selector-item" class="color-selector-item bg-orange rounded-pill mr-2"></div>
        <div v-on:click="selectedColor='yellow'" :class="selectedColor==='yellow'? 'color-selector-item-selected':''"
            data-testid="yellow-color-selector-item" class="color-selector-item bg-yellow rounded-pill mr-2"></div>

        <div v-on:click="selectedColor='indigo'" :class="selectedColor==='indigo'? 'color-selector-item-selected':''"
            data-testid="indigo-color-selector-item" class="color-selector-item bg-indigo rounded-pill mr-2"></div>
        <div v-on:click="selectedColor='purple'" :class="selectedColor==='purple'? 'color-selector-item-selected':''"
            data-testid="purple-color-selector-item" class="color-selector-item bg-purple rounded-pill "></div>


    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ref, watch } from 'vue'

const selectedColor=ref('grey')
const emit=defineEmits(['color-change'])


watch(selectedColor, () => {
    emitColor();
})

function emitColor(): void {

    switch (selectedColor.value) {
        case 'black': return emit('color-change', '#000000');
        case 'white': return emit('color-change', '#FFFFFF');
        case 'purple': return emit('color-change', '#665BC0');
        case 'indigo': return emit('color-change', '#68C0C0');
        case 'green': return emit('color-change', '#53857D');
        case 'yellow': return emit('color-change', '#F8DA5F');
        case 'orange': return emit('color-change', '#EE8740');
        case 'red': return emit('color-change', '#BB2D1B');
        case 'pink': return emit('color-change', '#E16FBC');
    }


}
</script>

<style scoped>
.color-selector-item {
    width: 20px;
    height: 20px;
    transition: all 50ms linear;

}

.color-selector-item:hover {
    transform: scale(1.2);
    transition: all 50ms linear;

}

.color-selector-item-selected {
    pointer-events: none;
    transform: scale(1.2);
    border-radius: 4px !important;

}
</style>
