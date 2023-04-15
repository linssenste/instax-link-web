<template>
    <div class="ml-0 d-flex flex-row align-center">
        <a style="text-decoration: none!important;" href="https://github.com/linssenste/instax-link-web" target="_blank">
            <v-btn class="mr-6" color="black" icon variant="tonal" density="comfortable"><v-icon size="large"
                    color="black">mdi-github</v-icon></v-btn>
        </a>


        <div v-on:click="selectedColor='pink'" :class="selectedColor==='pink'? 'color-selector-item-selected':''"
            data-testid="pink-color-selector-item" class="color-selector-item bg-pink rounded-pill ">
        </div>
        <div v-on:click="selectedColor='red'" :class="selectedColor==='red'? 'color-selector-item-selected':''"
            data-testid="red-color-selector-item" class="color-selector-item bg-red rounded-pill "></div>
        <div v-on:click="selectedColor='orange'" :class="selectedColor==='orange'? 'color-selector-item-selected':''"
            data-testid="orange-color-selector-item" class="color-selector-item bg-orange rounded-pill "></div>


        <div v-on:click="selectedColor='purple'" :class="selectedColor==='purple'? 'color-selector-item-selected':''"
            data-testid="purple-color-selector-item" class="color-selector-item bg-purple rounded-pill "></div>




    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { ref, watch } from 'vue'

const selectedColor=ref('white')
const emit=defineEmits(['color-change'])


onMounted(() => {
    selectedColor.value=localStorage.getItem('background')||'pink'
})

watch(selectedColor, () => {
    emitColor();
})

function emitColor(): void {

    localStorage.setItem('background', selectedColor.value)
    emit('color-change', selectedColor.value)

}
</script>

<style scoped>
.color-selector-item {
    width: 20px;
    cursor: pointer;
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
    border-radius: 4px !important;

}
</style>
