<template>
    <div style="height: 20px; min-width: 50px;">
        <div class=" device-info text-grey-darken-2 font-weight-bold" data-testid="images-left">
            <v-icon :color="status==null||status.imagesLeft==null||status.imagesLeft<=1? 'red-lighten-1':''" size="default"
                class="mr-1" style="margin-bottom: 2px" data-testid="images-icon">
                mdi-polaroid
            </v-icon>
            <span :class="status==null||status.imagesLeft==null||status.imagesLeft<=1? 'text-red-lighten-1 ':''"
                data-testid="images-text">
                {{status==null? 0:(status.imagesLeft!=null&&status.imagesLeft>=0? status.imagesLeft:0)}} / 10
            </span>

        </div>


    </div>
</template>

<script setup lang="ts">

const props=defineProps<{
    status: any
}>()

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
