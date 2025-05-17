
<template>
	<div class="link-row">


		<!-- Github icon link to Project -->
		<a  data-testid="github-link" href="https://github.com/linssenste/instax-link-web"
		   class="link" title="View project on GitHub" target="_blank" rel="noopener noreferrer">

			<img alt="link to github page of this project" draggable="false" src="@/assets/icons/github-icon.svg" width="30"
				 height="30" />
		</a>
	</div>
</template>


<style scoped>
.link-row {
	position: relative;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 15px
}

.link {

	cursor: pointer;
	transition: all 150ms ease-in-out;

	-moz-user-select: none;
	-webkit-user-select: none;
	user-select: none;

}

.link:hover {
	transform: scale(1.1);
}




</style>