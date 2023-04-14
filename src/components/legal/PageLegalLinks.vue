<template>
    <div>
        <router-link class="mr-8 link text-uppercase" to="imprint">IMPRESSUM</router-link>
        <router-link class="mr-8 link text-uppercase" to="privacy">PRIVACY POLICY</router-link>
        <a href="https://instax.com/printer/" target="_blank" class="mr-8 link text-uppercase">Github</a>

        <a href="https://instax.com/printer/" target="_blank" class="mr-8 link text-uppercase">INSTAX WEBSITE</a>
    </div>
</template>


<script setup lang="ts">

</script>


<style scoped>
.link {
    font-size: 14px;
    color: #505050;
    letter-spacing: 1px;
    cursor: pointer;
    text-decoration: none;
}

.link:hover {
    font-weight: 800;
    color: black;
    transition: all 100ms linear;
}
</style>