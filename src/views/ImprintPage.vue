<template>
    <div style=" position: relative; height: 100%" class="d-flex flex-column align-center justify-center">
        <div style="width: 800px; max-width: calc(100% - 10px); ">
            <router-link to="creator"><v-btn class=" pl-4 pr-6 text-grey-darken-2 font-weight-bold"
                    color="transparent"><v-icon size="large" class="mr-2">mdi-chevron-left</v-icon>Instax Creator</v-btn>
            </router-link>
        </div>
        <div style=" height: calc(100% - 130px); width: 800px; max-width: calc(100% - 10px); background-color: #FFFFFFCC; overflow: hidden; position: relative;"
            class="rounded-lg mt-2">


            <div class="pa-5 pb-12 pr-10 pl-8 "
                style="overflow-y: auto; text-align: justify; text-justify: inter-word; height: 100%; width: 100%;  overflow-x: hidden;">
                <h2 class="text-uppercase mt-4 mb-8" style="letter-spacing: .8px;">Legal Imprint</h2>
                <span :class="`text-${color} font-weight-bold mb-2 mt-6 text-uppercase`" style="letter-spacing: 1px;">Please
                    NOTE:</span>
                <p>This is just a fun open-source project to play around with the INSTAX printer. The code and
                    app
                    are
                    provided as-is, without any warranty of any kind. The authors of this
                    project do not take any responsibility for any damage, direct or indirect, caused by the use of this
                    code/app.
                    The source code can be found on the GitHub page, and contributions are welcome! Please don't take this
                    too
                    seriously, and have fun experimenting with your INSTAX printer!
                </p>
                <h3 class="mt-8 mb-2">Information pursuant to § 5 of the German Telemedia Act (TMG):</h3>
                <ul class="ml-4">
                    <li>Steffen Linßen<br> Klosterstr. 3d, 85221 Dachau</li>
                    <li><a :class="`text-${color} font-weight-bold`" style="text-decoration: none;" target="_blank"
                            href="https//linssenste.com">linssenste@gmail.com</a>
                    </li>
                </ul>
                <h3 class="mt-8 mb-2">Represented by:</h3>
                <p>Steffen Linßen</p>
                <h3 class="mt-8 mb-2">Responsible for the content pursuant to § 55 paragraph 2 of the German Interstate
                    Broadcasting
                    Agreement (RStV):
                </h3>
                <p>Steffen Linßen<br> Klosterstr 3d, 85221 Dachau</p>
                <h3 class="mt-8 mb-2">Dispute resolution:</h3>
                <p>The European Commission provides a platform for online dispute resolution (ODR): <a
                        :class="`text-${color} font-weight-bold`" style="text-decoration: none;" target="_blank"
                        href="https://ec.europa.eu/consumers/odr">https://ec.europa.eu/consumers/odr</a>. Our email address
                    can
                    be
                    found
                    above in the imprint. We are not willing or obliged to participate in dispute resolution proceedings
                    before
                    a
                    consumer arbitration board.</p>
                <h3 class="mt-8 mb-2">Liability for content:</h3>
                <p>As a service provider, we are responsible for our own content on these pages according to § 7 para.1 TMG
                    (German
                    Telemedia Act) and general laws. According to §§ 8 to 10 TMG, however, we are not obliged as a service
                    provider
                    to
                    monitor transmitted or stored third-party information or to investigate circumstances that indicate
                    illegal
                    activity. Obligations to remove or block the use of information according to general laws remain
                    unaffected
                    by
                    this.
                    However, liability in this regard is only possible from the time of knowledge of a concrete
                    infringement. If
                    we
                    become aware of any such legal infringements, we will remove the content in question immediately.</p>
                <h3 class="mt-8 mb-2">Liability for links:</h3>
                <p>Our offer contains links to external websites of third
                    parties, on
                    whose
                    contents we have no influence.
                    Therefore, we
                    cannot assume any liability for these external contents. The respective provider or operator of the
                    pages is
                    always
                    responsible for the contents of the linked pages. The linked pages were checked for possible legal
                    violations at
                    the
                    time of linking. Illegal contents were not recognizable at the time of linking. However, a permanent
                    control
                    of
                    the
                    contents of the linked pages is not reasonable without concrete evidence of a violation of the law. If
                    we
                    become
                    aware of any infringements, we will remove such links immediately.</p>
                <h3 class="mt-8 mb-2">Copyright:</h3>
                <p>The contents and works on these pages created by the site operators are subject to German copyright law.
                    The
                    reproduction, editing, distribution and any kind of use outside the limits of copyright law require the
                    written
                    consent of the respective author or creator. Downloads and copies of these pages are only permitted for
                    private,
                    non-commercial use. Insofar as the content on this site was not created by the operator, the copyrights
                    of
                    third
                    parties are respected

                    and indicated as such. Should you nevertheless become aware of a copyright infringement, please inform
                    us
                    accordingly. If we become aware of any infringements, we will remove such content immediately.</p>

            </div>
        </div>

    </div>
</template>


<script setup lang="ts">
import { onMounted } from 'vue';
import { ref } from 'vue'

const props=defineProps<{
    color: string
}>()

props.color;
</script>

