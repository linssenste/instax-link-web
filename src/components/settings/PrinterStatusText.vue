<template>
    <div :class="`text-${color} font-weight-bold text-uppercase status-text align-center d-flex flex-row`"
        data-testid="status-text" :style="center? '':'width: 130px;'">
        <!-- Display different text based on the printerStatus prop -->
        <v-progress-circular v-if="printerStatus===4||printerStatus===3||printerStatus===2" indeterminate size="18"
            width="3" class="mr-3" :color="color" data-testid="status-loader"></v-progress-circular>


        <span v-if="printerStatus===3" data-testid="printing-text">Printing</span>
        <span v-else-if="printerStatus===2" data-testid="sending-text">SENDING</span>
        <span v-else-if="printerStatus===4" data-testid="canceling-text">STOPPING</span>
        <span v-else data-testid="standby-text">STANDBY</span>

    </div>
</template>

<script setup lang="ts">
const props=defineProps<{
    printerStatus: number,
    color: string;
    center?: boolean;
}>()

props.printerStatus;
props.color;
props.center;
</script>

<style scoped>
.status-text {
    letter-spacing: 2px;
    font-size: 13px;

    padding-top: 1px;
}
</style>
