<template>
    <div style="height: 20px">
        <div v-if="isPrinting==false" class=" device-info font-weight-bold" data-testid="images-left">
            <v-icon :color="status==null||status.imagesLeft==null||status.imagesLeft<=1? 'red':''" size="default"
                class="mr-1" style="margin-bottom: 2px" data-testid="images-icon">
                mdi-polaroid
            </v-icon>
            <span :class="status==null||status.imagesLeft==null||status.imagesLeft<=1? 'text-red ':''"
                data-testid="images-text">
                {{status==null? 0:(status.imagesLeft||0)}} / 10
            </span>
        </div>

        <div v-else class=" device-info text-primary font-weight-medium text-uppercase" style="letter-spacing: .8px">
            <!-- <v-progress-circular class="mr-3" size="20" width="3" indeterminate color="primary"></v-progress-circular> -->
            <span class="text-grey-darken-1" data-testid="printing-text">Printing...</span>
        </div>
    </div>
</template>

<script setup lang="ts">

const props=defineProps<{
    isPrinting: boolean
    status: any
}>()

props.isPrinting
props.status;
</script>

<style scoped>
.device-info {
    margin-left: 1px;
    font-size: 14px;
    font-weight: 700;
    color: #808080;
}
</style>
