<template>
    <div :class="`text-${color}`" class="  font-weight-bold text-uppercase"
        style="letter-spacing: 2px; font-size: 13px;; width: 100px; padding-top: 1px">
        <!-- <v-progress-circular class="mr-3" size="20" width="3" indeterminate color="primary"></v-progress-circular> -->
        <span v-if="printerStatus===3" data-testid="printing-text">Printing</span>
        <span v-else-if="printerStatus===2" data-testid="printing-text">SENDING</span>

        <span v-else data-testid="printing-text">STANDBY</span>
    </div>
</template>


<script setup lang="ts">

const props=defineProps<{
    printerStatus: number,
    color: string
}>()

props.printerStatus;
props.color
</script>
