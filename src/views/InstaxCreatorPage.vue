<template>
    <div class="pt-12 pb-2">
        <div style="position: absolute; left: 50%; top: calc(50% - 200px); transform: translate(-50%, -50%);">
            <ConfettiExplosion v-if="showExplosion" :particleCount="40" :particleSize="4" :duration="2000" :wind="-100"
                :gravity="50" :colors="['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff']"
                :shouldDestroyAfterDone="true" />
        </div>

        <PolaroidEditor v-on:saveable="isSaveable=$event" v-on:save="savedImageEvent" :color="color" :config="config"
            :printerStatus="printerStatus" :save="togglePrinting">
            <template v-slot:overlay>
                <div style="position: relative; width: 100%; height: 100%;">
                    <div class="overlay-status">
                        <PrinterStatusText v-if="!fatalPrintError" :error="fatalPrintError" :center="true"
                            :printerStatus="printerStatus" :color="color" />
                        <div v-else data-testid="printing-error"
                            class="text-uppercase d-flex flex-row align-center text-red font-weight-bold"
                            style="font-size: 14px"><v-icon size="small" class="mr-2">mdi-close-circle</v-icon>Printing
                            error
                        </div>
                    </div>


                    <v-progress-linear v-if="printerStatus===2&&!fatalPrintError" :color="color"
                        style="width: 200px; top: 200px!important; position: absolute;" :height="10"
                        class="rounded-pill mt-2" :model-value="(printProgress.transfered*100)"></v-progress-linear>

                </div>
            </template>


            <template v-slot:text-area>
                <div>
                    <div v-if="printerStatus===2&&!fatalPrintError" class="d-flex flex-row align-center">
                        <v-btn data-testid="minus-button" :disabled="totalPrints<=1" v-on:click="totalPrints-=1"
                            :ripple="false" class="mr-4" icon density="compact" variant="tonal"><v-icon
                                size="x-small">mdi-minus</v-icon></v-btn>
                        <div style="font-size: 20px; width: 15px; text-align: center;" class="font-weight-medium">
                            {{totalPrints}}</div>
                        <v-btn data-testid="plus-button" :disabled="totalPrints>=10||totalPrints>=config.imagesLeft"
                            v-on:click="totalPrints+=1" :ripple="false" class="ml-4" icon density="compact"
                            variant="tonal"><v-icon size="x-small">mdi-plus</v-icon></v-btn>

                    </div>

                    <div v-else-if="printerStatus===3&&printProgress.printed<=totalPrints"
                        class=" mt-0 text-uppercase text-grey-darken-1 font-weight-bold "
                        style="letter-spacing: 2px; text-align: center; font-size: 14px">
                        <span> {{printProgress.printed+1}} </span> / {{totalPrints}}
                    </div>
                </div>
            </template>
        </PolaroidEditor>
        <v-btn data-testid="download-button" class="mt-6 font-weight-bold" variant="tonal" :color="color" block
            :disabled="!isSaveable" v-on:click="downloadImageRequest()">
            <v-icon class="mr-2">mdi-download</v-icon>
            DOWNLOAD

        </v-btn>

        <v-btn data-testid="print-button" v-if="printerStatus==1&&loadPrinting==false" class="mt-2 font-weight-bold"
            variant="flat" :color="color" block :disabled="!isSaveable||config.width!=800" v-on:click="printImageRequest()">
            Print image
            <v-icon class="ml-2">mdi-chevron-right</v-icon>

        </v-btn>

        <v-btn data-testid="cancel-button" :loading="loadPrinting" v-else-if="printerStatus>1||loadPrinting==true"
            :disabled="printerStatus===4" class="mt-2 font-weight-bold" variant="flat" :color="color" block
            v-on:click="cancelPrinting()">

            <v-icon class="mr-2">mdi-close</v-icon>
            Cancel


        </v-btn>

    </div>
</template>

 
<script setup lang="ts">
import PolaroidEditor from '@/components/polaroid/PolaroidEditor.vue';
import PrinterStatusText from '@/components/settings/PrinterStatusText.vue';
import ConfettiExplosion from "vue-confetti-explosion";
import { nextTick } from 'vue';
import { ref } from 'vue'



const togglePrinting=ref(false)
const isSaveable=ref(false)
const printProgress=ref({ transfered: 0, printed: 0, total: 1 })
const exportStatus=ref(0);
const totalPrints=ref(1);


const props=defineProps<{
    color: string,
    printerStatus: number,
    config: any,
    print: (imageUrl: string, numberImages: any, callback: (progress: any) => void, abortController: AbortController) => void
}>()

const loadPrinting=ref(false)
const abortController=ref<AbortController|null>(null);

const showExplosion=ref(false)

function explode() {
    if (showExplosion.value==true) return;
    showExplosion.value=true;

    setTimeout(() => {
        showExplosion.value=false

    }, 3000);
}


async function cancelPrinting(): Promise<void> {

    if (abortController.value) {
        abortController.value.abort();



    }
}

const fatalPrintError=ref(false)
async function printImage(imageUrl: string): Promise<void> {
    if (imageUrl===null) return;

    abortController.value=null;

    fatalPrintError.value=false;

    await nextTick();

    abortController.value=new AbortController();

    try {
        await props.print(imageUrl, totalPrints, (progress: any) => {
            if ((progress.printed-printProgress.value.printed)==1) explode();
            printProgress.value=progress;


        }, abortController.value)

    } catch (error) {

        fatalPrintError.value=true;
        cancelPrinting()
    } finally {
        printProgress.value={ transfered: 0, printed: 0, total: 1 }

    }

}


function savedImageEvent(imageUrl: string): void {

    if (exportStatus.value==0) {
        explode();
        var a=document.createElement("a"); //Create <a>
        a.href=imageUrl
        a.download=`polaroid-${props.config.width}x${props.config.height}.jpg`;
        a.click(); // download
    } else {
        console.log("PRINTIN")
        printImage(imageUrl)
    }

    exportStatus.value=0;

}

function downloadImageRequest(): void {
    exportStatus.value=0;
    togglePrinting.value=!togglePrinting.value

}
function printImageRequest(): void {

    exportStatus.value=1;
    totalPrints.value=1;
    loadPrinting.value=true

    togglePrinting.value=!togglePrinting.value

    setTimeout(() => {
        loadPrinting.value=false
    }, 1000);
}

props.color;
props.printerStatus;
props.config;
</script>


<style scoped>
.overlay-status {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
}


.progress-status {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
}
</style>