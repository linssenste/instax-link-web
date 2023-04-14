

<template>
    <div class="scroller" >
        <section>
            <div data-color="#dcdcdc" class="portfolio-card" oncontextmenu="return false">

                <div class="d-flex flex-row align-start justify-center flex-wrap">

                    <div style="position: relative; width: 100%; max-width: 650px; ">
                        <div class="floating-card">
                                <img  src="@/assets/ar.png" />
                        </div>
                    </div>

                    <div class="ml-8 mr-8"
                        style="width: 100%; max-width: 650px; border-radius: 8px; height: 100%; background-color: transparent">
                        <h2> Inbox</h2>
                    </div>

                </div>

            </div>


            <div data-color="#99aba0" class="portfolio-card">

                <div class="d-flex flex-row align-start justify-center flex-wrap">
                    <div style="position: relative; width: 100%; max-width: 650px; ">
                        <div class="floating-card" style="max-width: 400px;">
                            <img width="100%" style="object-fit: cover;" src="@/assets/ar2.png" />

                        </div>

                    </div>
                    <div class="ml-8 mr-8"
                        style="width: 100%; max-width: 650px; border-radius: 8px; height: 100%; background-color: transparent">
                        <h2> Inbox</h2>
                    </div>
                </div>

            </div>


        <!-- <div class="portfolio-card" data-color="#f1bace">
  <img style="width: 100%; height: 100%"  preload src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2168&q=80"  />
          </div>
  <img class="portfolio-card" preload src="https://images.unsplash.com/photo-1516085216930-c93a002a8b01?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2250&q=80" data-color="#ffbc00" /> -->
        <!-- <img preload src="https://images.unsplash.com/photo-1458819714733-e5ab3d536722?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=933&q=80" data-color="#cfdfde" />
  <img preload src="https://images.unsplash.com/photo-1520013817300-1f4c1cb245ef?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2287&q=80" data-color="#3c94c5" />
  <img preload src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2247&q=80" data-color="#99aba0" />
  <img preload src="https://images.unsplash.com/photo-1559181567-c3190ca9959b?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1300&q=80" data-color="#b0e6db" />
  <img preload src="https://images.unsplash.com/photo-1560393464-5c69a73c5770?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1301&q=80" data-color="#fe6f62" />
  <img preload src="https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2249&q=80" data-color="#eed2b7" />
  <img preload src="https://images.unsplash.com/photo-1481349518771-20055b2a7b24?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2309&q=80" data-color="#f8bbc6" />
          <img preload src="https://images.unsplash.com/photo-1579613832111-ac7dfcc7723f?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2250&q=80" data-color="#08bac3" />
          <img preload src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=2189&q=80" data-color="#dcdcdc" /> -->
        </section>
    </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue';

const props=defineProps({
    foo: { type: String, required: true },
    bar: Number
})




onMounted(() => {
    const section=document.querySelector("section");
    const images=[...document.getElementsByClassName("portfolio-card")];

    let currentTarget: any=null
    console.log(images)
    if (section==null) return;
    const observer=new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    console.log(entry)
                    if (currentTarget!=null) (currentTarget as any).classList.remove("animate")
                    entry.target.classList.add("animate");
                    currentTarget=entry.target;
                    (section as any).style.backgroundColor=entry.target.getAttribute("data-color");
                }
            });
        },
        {
            threshold: 0.75
        }
    );

    images.forEach((el, i) => {
        observer.observe(el);
    });

})
props.foo // string
props.bar // number | undefined
</script>

<style scoped lang="scss">
.scroller {
    overscroll-behavior-x: none;

    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    scroll-behavior: smooth;
    display: flex;
    height: 100%;

    //   align-items: center;
    //   overflow: hidden;
    //   justify-content: center;
}



section {
    width: 100%;
    box-sizing: border-box;
    transition: 0.3s;
    background-color: #f1bace;
    white-space: nowrap;
    position: relative;
    height: 100%;
    overflow: auto;
    scroll-snap-type: y mandatory;

}

.floating-card img {
    flex-shrink: 0;
    width: 100%;
    // height: 100%
}

.floating-card {
    // width:
    // background-color: red;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    //   opacity: 0;
    // top: 50%; transform: translateY(-50%);
    //   background-color: red;
    height: fit-content;
    margin: 0 auto;
    
height: 100%!important;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;

    width: 100%;


    transition: transform 100ms ease-in-out;
}


.floating-card:hover {
    transform: scale(1.015);
    transition: transform 100ms ease-in-out;
}

.portfolio-card {
    transition: 0.3s;

    pointer-events: none;
    opacity: .3;
    position: relative;
    width: 100%;
    height: 75%;
    padding: 12px;
    scroll-snap-align: start;
    padding-top: 50px;
    //   height: 100%;
    // height: 80%;

    // margin-top: 25%;

    overflow: hidden;
    //   margin-top: 25vh;
    flex-shrink: 0;

}

.animate {
    pointer-events: all !important;
    opacity: 1;
}


// .portfolio-card:first-child {
//     padding-top: 53px;
// }


.outer {
    background: rgb(235, 235, 235);
    opacity: 0.9;
    width: 100%;
    margin: 0px auto;
    padding: 6px;
    padding-left: 12px;
    border-radius: 7px 7px 0px 0px;


}

.dot {
    display: inline-block;
    width: 11px;
    height: 11px;
    background: #f9f9f9;
    border-radius: 50%;
    margin: 0 7px 0 0;

    &.red {
        background: rgb(237, 106, 94);
        border: 1px solid rgb(237, 106, 94);
        ;
    }

    &.amber {
        background: rgb(245, 191, 79);
        border: 1px solid rgb(245, 191, 79);
    }

    &.green {
        background: rgb(99, 200, 86);
        border: 1px solid rgb(99, 200, 86);
        ;
    }
}
</style>
