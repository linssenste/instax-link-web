<template>
    <div style="position: absolute; height: 100%; width: 100%; z-index: 50">
        <div :key="printingCount" v-if="isPrinting&&!aborting&&printingCount>0" class="printing-animation"></div>
        <div style="position: absolute; height: 100%; width: 100%; background-color: rgba(240, 240, 240, .3); transition: all 150ms linear;"
            class="d-flex flex-row align-center justify-center">


            <div class="font-weight-bold text-uppercase text-grey-darken-2"
                style="position: absolute; bottom: 40px; text-align: center; width: 100%; letter-spacing: 2px; font-size: 14px">
                <span v-if="isPrinting&&!aborting&&printingCount>0">PRINTING Image #{{printingCount}}...</span>

                <span v-else-if="isPrinting&&!aborting">SENDING IMAGE Data </span>
                <span v-else-if="isPrinting&&aborting">Canceling</span>
            </div>




            <v-progress-linear v-if="!aborting&&!(isPrinting&&!aborting&&printingCount>0)" :color="color"
                style="width: 200px; top: 200px!important; position: absolute;" :height="10" class="rounded-pill mt-2"
                :model-value="(progress*100)"></v-progress-linear>
        </div>
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


<style scoped lang="scss">
.printing-animation {
    height: 0px;
    width: 100%;
    background-color: #C0C0C0;
    position: absolute;
    animation: print 12.5s;
    bottom: 0px;


}

@keyframes print {
    0% {
        height: 100%;
    }

    100% {
        height: 0%;
    }
}

.logo {
    font-family: 'Rock Salt';

    font-weight: 900;
    color: transparent;
    letter-spacing: 5px;
    position: absolute;
    top: 15px;
    left: 20px;
    font-size: 30px;
    background: linear-gradient(90deg,
            #E16FBC 0%,
            #BB2D1B 16.66%,
            #EE8740 33.33%,
            #e2bd2a 50%,
            #53857D 66.66%,
            #68C0C0 83.33%,
            #665BC0 100%);
    background-clip: text;
    -webkit-background-clip: text;
}

@keyframes rainbow {
    100% {
        background-position: 60em 0;
    }
}
</style>