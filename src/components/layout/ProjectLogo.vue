<template>
	<a class="project-link" title="Open tool in a new tab" href="https://linssenste.dev" target="_blank">
		<span class="project-link-instax">instax</span>
		<span class="project-link-web">WEB</span>
	</a>
</template>



<style scoped>
.project-link {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;

	text-decoration: none;
	color: black;
	height: 30px;
	width: fit-content;
	gap: 10px!important;

}

.project-link span {
	transition: all 150ms linear;

	opacity: .75;
}

.project-link:hover span {
	opacity: 1;
}


.project-link:hover  .project-link-web {
	transform: scale(1.05);
}
.project-link-instax {
	font-family: 'Keedy Sans';
	font-size: 30px;
	color: var(--dynamic-bg-color)
}

.project-link-web {
	font-family: 'biro_script_standardregular';
	font-size: 35px;
	margin-top: 12px;
}
</style>