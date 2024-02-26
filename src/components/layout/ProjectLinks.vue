
<template>
	<div class="link-row">


		<!-- Storybook Chromatic link (project documentation) -->
		<a data-testid="bmc-link" href="https://www.buymeacoffee.com/linssenste"
		   class="link" title="Creators Buy-me-a-Coffee page" target="_blank" rel="noopener noreferrer">

			<img alt="link to developers BMC page for support" draggable="false" src="@/assets/icons/bmc-icon.svg" 
				 height="30" width="21" />
		</a>

		<!-- Storybook Chromatic link (project documentation) -->
		<a data-testid="storybook-link" href="https://github.com/linssenste/instax-link-web"
		   class="link" title="Project documentation on Storybook" target="_blank" rel="noopener noreferrer">

			<img alt="link to storybook page of this project" draggable="false" src="@/assets/icons/storybook-icon.svg" 
				 height="30" width="25" />
		</a>

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