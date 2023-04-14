<template>
    <div class="d-flex flex-row align-center battery-info" v-if="status!=null" data-testid="battery-status">
        <v-icon :color="batteryColor" v-if="!status.isCharging" data-testid="battery-icon">
            mdi-battery{{(Math.round((status.batteryLevel||20)/10)*10)<100? '-'
                +Math.round((status.batteryLevel||20)/10)*10:''}} </v-icon>
                <v-icon v-else color="green" data-testid="charging-icon">
                    mdi-battery-charging
                </v-icon>
                <div :class="`text-${batteryColor}`" class="font-weight-bold ml-1" data-testid="battery-text">
                    <span v-if="!status.isCharging"> {{status.batteryLevel||50}} %</span>
                    <span v-else class="text-uppercase" style="letter-spacing: .8px;">Charging</span>
                </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'

const props=defineProps<{
    status: any
}>()

const batteryColor=computed(() => {
    return (props.status.isCharging===true||(props.status.batteryLevel||50)>=95)
        ? 'green'
        :(props.status.batteryLevel||50)>=30
            ? 'black'
            :(props.status.batteryLevel||50)>=20
                ? 'orange'
                :'red'
})

nextTick(() => {
    props.status
})
</script>

<style scoped>
.battery-info {
    margin-left: 0px;
    font-size: 14px;
    height: 20px;
    font-weight: 700;
    color: #808080;
}
</style>
