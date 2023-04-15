<template>
    <div :class="`text-${color} font-weight-bold text-uppercase status-text`" data-testid="status-text">
        <!-- Display different text based on the printerStatus prop -->
        <span v-if="printerStatus===3" data-testid="printing-text">Printing</span>
        <span v-else-if="printerStatus===2" data-testid="sending-text">SENDING</span>
        <span v-else data-testid="standby-text">STANDBY</span>
    </div>
</template>

<script setup lang="ts">
const props=defineProps<{
    printerStatus: number,
    color: string
}>()

props.printerStatus;
props.color;
</script>

<style scoped>
.status-text {
    letter-spacing: 2px;
    font-size: 13px;
    width: 100px;
    padding-top: 1px;
}
</style>
