<template>
    <div class="ml-0 d-flex flex-row align-center">
        <v-btn class="mr-6" v-if="!dense" color="black" icon variant="tonal" density="comfortable"><v-icon size="large"
                color="black">mdi-github</v-icon></v-btn>
        <div v-if="dense" v-on:click="selectedColor='black'"
            :class="selectedColor==='black'? 'color-selector-item-selected':''" data-testid="purple-color-selector-item"
            class="color-selector-item bg-black rounded-pill "></div>

        <div v-if="dense" v-on:click="selectedColor='white'"
            :class="selectedColor==='white'? 'color-selector-item-selected':''" data-testid="indigo-color-selector-item"
            class="color-selector-item bg-grey-lighten-3 rounded-pill "></div>
        <div v-on:click="selectedColor='pink'" :class="selectedColor==='pink'? 'color-selector-item-selected':''"
            data-testid="pink-color-selector-item" class="color-selector-item bg-pink rounded-pill ">

        </div>
        <div v-if="!dense" v-on:click="selectedColor='red'"
            :class="selectedColor==='red'? 'color-selector-item-selected':''" data-testid="red-color-selector-item"
            class="color-selector-item bg-red rounded-pill "></div>
        <div v-on:click="selectedColor='orange'" :class="selectedColor==='orange'? 'color-selector-item-selected':''"
            data-testid="orange-color-selector-item" class="color-selector-item bg-orange rounded-pill "></div>
        <div v-if="dense" v-on:click="selectedColor='yellow'"
            :class="selectedColor==='yellow'? 'color-selector-item-selected':''" data-testid="yellow-color-selector-item"
            class="color-selector-item bg-yellow rounded-pill "></div>

        <div v-if="dense" v-on:click="selectedColor='indigo'"
            :class="selectedColor==='indigo'? 'color-selector-item-selected':''" data-testid="indigo-color-selector-item"
            class="color-selector-item bg-indigo rounded-pill "></div>
        <div v-if="!dense" v-on:click="selectedColor='purple'"
            :class="selectedColor==='purple'? 'color-selector-item-selected':''" data-testid="purple-color-selector-item"
            class="color-selector-item bg-purple rounded-pill "></div>




    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ref, watch } from 'vue'

const selectedColor=ref('white')
const emit=defineEmits(['change'])

const props=defineProps<{
    dense?: boolean
}>()
onMounted(() => {
    if (props.dense!==true) selectedColor.value=localStorage.getItem('background')||'pink'
    else selectedColor.value='white';

    emitColor();
})

watch(selectedColor, () => {
    emitColor();
})

function emitColor(): void {
    if (props.dense!=true) {
        localStorage.setItem('background', selectedColor.value)
        emit('change', selectedColor.value)
    } else {
        switch (selectedColor.value) {
            case 'black': return emit('change', '#000000');
            case 'white': return emit('change', '#FFFFFF');
            case 'purple': return emit('change', '#665BC0');
            case 'indigo': return emit('change', '#68C0C0');
            case 'green': return emit('change', '#53857D');
            case 'yellow': return emit('change', '#F8DA5F');
            case 'orange': return emit('change', '#EE8740');
            case 'red': return emit('change', '#BB2D1B');
            case 'pink': return emit('change', '#E16FBC');
        }

    }
}
</script>

<style scoped>
.color-selector-item {
    width: 20px;
    height: 20px;
    transition: all 50ms linear;
    margin-right: 14px !important;
}

.color-selector-item:hover {
    transform: scale(1.3);
    transition: all 50ms linear;

}

.color-selector-item-selected {
    pointer-events: none;
    transform: scale(1.3);
    border-radius: 6px !important;

    transition: border-radius 1150ms linear;
}
</style>
