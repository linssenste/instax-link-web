
<template>
	<div class="link-row">

		<!-- @TODO: SEO optimized project infos here -->
		<ProjectInformation/>
		
		<!-- Github icon link to Project -->
		<a oncontextmenu="return false" data-testid="github-link" href="https://github.com/linssenste/instax-link-web"
		   class="github-link" target="_blank">

			<img alt="link to github page of this project" draggable="false" src="@/assets/icons/github-icon.svg" width="30"
				 height="30" />
		</a>
	</div>
</template>

<script setup lang="ts">
import ProjectInformation from '@/components/layout/ProjectInformation.vue'
</script>
<style scoped>
.link-row {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
}

.github-link {

	cursor: pointer;
	transition: all 150ms ease-in-out;

	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;

}

.github-link:hover {
	transform: scale(1.1);
}




</style>