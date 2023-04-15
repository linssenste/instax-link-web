<template>
    <div class="d-flex flex-row align-center battery-info" v-if="status!=null" data-testid="battery-status">
        <v-icon :color="batteryColor" v-if="!status.isCharging" data-testid="battery-icon">
            mdi-battery{{(Math.round((status.batteryLevel||20)/10)*10)<100? '-'
                +Math.round((status.batteryLevel||20)/10)*10:''}} </v-icon>
                <v-icon v-else color="green-darken-1" data-testid="charging-icon">
                    mdi-battery-charging
                </v-icon>
                <div :class="`text-${batteryColor}`" class="font-weight-bold ml-1" style="font-size: 14px"
                    data-testid="battery-text">
                    <span v-if="!status.isCharging&&status.batteryLevel!=null"> {{status.batteryLevel||50}} %</span>
                    <span v-else-if="status.isCharging==true" class="text-uppercase"
                        style="letter-spacing: .8px;">POWER</span>
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
        ? 'green-darken-1'
        :(props.status.batteryLevel||50)>=30
            ? 'grey-darken-2'
            :(props.status.batteryLevel||50)>=20
                ? 'orange-darken-1'
                :'red-darken-1'
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
