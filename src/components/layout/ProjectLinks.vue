<template>

<div class="link-row">
<a oncontextmenu="return false" href="https://github.com/linssenste/instax-link-web" class="github-link"
		   target="_blank">
			<img alt="link to github page of this project" draggable="false" src="@/assets/icons/github-icon.webp"
				 width="30" height="30" />

		</a>
		</div>
</template>

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
	user-select: none;

}

.github-link:hover {
	transform: scale(1.1);
}

</style>