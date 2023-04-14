<template>
    <div style="position: absolute; height: 100%; width: 100%; background-color: rgba(240, 240, 240, .5);"
        class="d-flex flex-row align-center justify-center">

        <v-progress-circular :color="color" size="40" width="6" indeterminate />

        <div class="text-grey-darken-1 font-weight-bold text-uppercase"
            style="position: absolute; bottom: 50px; text-align: center; width: 100%; letter-spacing: .8px; font-size: 14px">
            <span v-if="isPrinting&&!aborting&&printingCount>0">PRINTING Image {{printingCount}}...</span>

            <span v-else-if="isPrinting&&!aborting">SENDING IMAGE... </span>
            <span v-else-if="isPrinting&&aborting">Canceling...</span>
        </div>




        <!-- <v-progress-linear v-if="!aborting" color="primary"
                            style="width: 200px; top: 200px!important; position: absolute;" :height="10"
                            class="rounded-pill mt-2" :model-value="(progress*100)"></v-progress-linear> -->
    </div>
</template>


<script setup lang="ts">

const props=defineProps<{
    color: string;
    progress: number;
    isPrinting: boolean;
    aborting: boolean;
    printingCount: number;
}>()

props.color;
props.progress
</script>