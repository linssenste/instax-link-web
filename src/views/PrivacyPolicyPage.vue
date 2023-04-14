<template>
    <div style="height: 100%; width: 100%; position: relative;" class="d-flex flex-column align-center justify-center">
        <div style="width: 800px; max-width: calc(100% - 10px);">
            <router-link to="creator">
                <v-btn class="pl-4 pr-6 text-grey-darken-2 font-weight-bold" color="transparent">
                    <v-icon size="large" class="mr-2">mdi-chevron-left</v-icon>Instax Creator
                </v-btn>
            </router-link>
        </div>

        <div style="height: calc(100% - 130px); width: 800px; max-width: calc(100% - 10px); background-color: #FFFFFFCC; overflow: hidden; position: relative;"
            class="rounded-lg mt-2">
            <div class="pa-5 pb-12 pr-10 pl-8 hide-scrollbar"
                style="height: 100%; width: 100%; overflow-x: hidden; text-align: justify; text-justify: inter-word;">
                <h2 class="text-uppercase mt-4 mb-10" style="letter-spacing: .8px;">Privacy Policy</h2>

                <p>This privacy policy sets out how we, the creators of the Instax Creator project, use and protect any
                    information that you give us when you use our website.</p>

                <p>We are committed to ensuring that your privacy is protected. Should we ask you to provide certain
                    information by which you can be identified when using this website, then you can be assured that it will
                    only be used in accordance with this privacy statement.</p>

                <p>We may change this policy from time to time by updating this page. You should check this page from time
                    to time to ensure that you are happy with any changes.</p>

                <h3 class="mt-8 mb-2">What we collect</h3>

                <p>We do not collect any personal information about you or any other user of our website.</p>

                <h3 class="mt-8 mb-2">What we do with the information we gather</h3>

                <p>We do not collect any personal information about you or any other user of our website, so we do not use
                    any information for any purpose.</p>

                <h3 class="mt-8 mb-2">Security</h3>

                <p>We are committed to ensuring that your information is secure. In order to prevent unauthorized access or
                    disclosure, we have put in place suitable physical, electronic and managerial procedures to safeguard
                    and secure the information we collect online.</p>

                <h3 class="mt-8 mb-2">Links to other websites</h3>

                <p>Our website may contain links to other websites of interest. However, once you have used these links to
                    leave our site, you should note that we do not have any control over that other website. Therefore, we
                    cannot be responsible for the protection and privacy of any information which you provide whilst
                    visiting such sites and such sites are not governed by this privacy statement. You should exercise
                    caution and look at the privacy statement applicable to the website in question.</p>

                <h3 class="mt-8 mb-2">Controlling your personal information</h3>

                <p>We do not collect any personal information about you or any other user of our website, so there is no
                    personal information for you to control.</p>

                <h3 class="mt-8 mb-2">How we use cookies</h3>

                <p>We do not use cookies on our website.</p>


            </div>
        </div>

    </div>
</template>


<script setup lang="ts">

const props=defineProps<{
    color: string
}>()


props.color;
</script>


