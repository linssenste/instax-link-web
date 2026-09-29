import { vi } from 'vitest'

// A minimal stand-in for the bits of Konva that CropperArea uses. Konva needs a
// real canvas, which jsdom does not provide, so the stage/layer/node geometry is
// modelled here instead - that is exactly the state the responsive sync touches.
type Point = { x: number, y: number }

export class FakeNode {
	attrs: Record<string, any>
	parent: FakeLayer | null = null
	destroyed = false

	private state: Record<string, any> = {
		x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1,
		rotation: 0, offsetX: 0, offsetY: 0, fill: '#FFFFFF'
	}

	constructor(config: Record<string, any> = {}) {
		this.attrs = { ...config };
		Object.assign(this.state, config);
	}

	private accessor(key: string, value?: any) {
		if (value === undefined) return this.state[key];
		this.state[key] = value;
		return this;
	}

	x(value?: number) { return this.accessor('x', value) }
	y(value?: number) { return this.accessor('y', value) }
	width(value?: number) { return this.accessor('width', value) }
	height(value?: number) { return this.accessor('height', value) }
	scaleX(value?: number) { return this.accessor('scaleX', value) }
	scaleY(value?: number) { return this.accessor('scaleY', value) }
	offsetX(value?: number) { return this.accessor('offsetX', value) }
	offsetY(value?: number) { return this.accessor('offsetY', value) }
	fill(value?: string) { return this.accessor('fill', value) }
	rotation(value?: number) { return this.accessor('rotation', value) }

	rotate(degrees: number) { this.state.rotation += degrees; return this }

	scale(value?: Point) {
		if (value === undefined) return { x: this.state.scaleX, y: this.state.scaleY };
		this.state.scaleX = value.x;
		this.state.scaleY = value.y;
		return this;
	}

	position(value?: Point) {
		if (value === undefined) return { x: this.state.x, y: this.state.y };
		this.state.x = value.x;
		this.state.y = value.y;
		return this;
	}

	// the real implementation walks the ancestor transforms; for the background
	// rect the only ancestor is the stage
	absolutePosition(value?: Point) {
		const stage = this.parent?.parent;
		if (value === undefined) {
			if (!stage) return { x: this.state.x, y: this.state.y };
			return {
				x: stage.x() + this.state.x * stage.scaleX(),
				y: stage.y() + this.state.y * stage.scaleY()
			};
		}
		if (!stage) {
			this.state.x = value.x;
			this.state.y = value.y;
		} else {
			this.state.x = (value.x - stage.x()) / stage.scaleX();
			this.state.y = (value.y - stage.y()) / stage.scaleY();
		}
		return this;
	}

	destroy() { this.destroyed = true }
}

export class FakeLayer extends FakeNode {
	children: FakeNode[] = []
	parent: any = null
	batchDraw = vi.fn()

	// mirrors Konva, where re-adding an attached node moves it instead of duplicating
	add(node: FakeNode) {
		if (node.parent === this) return this;
		node.parent = this;
		this.children.push(node);
		return this;
	}

	removeChildren() {
		this.children.forEach((child) => { child.parent = null });
		this.children = [];
		return this;
	}
}

export class FakeStage extends FakeNode {
	layers: FakeLayer[] = []
	listeners: Record<string, ((event: any) => void)[]> = {}
	pointer: Point = { x: 0, y: 0 }
	dragging = false

	startDrag = vi.fn(() => { this.dragging = true })
	stopDrag = vi.fn(() => { this.dragging = false })

	add(layer: FakeLayer) {
		layer.parent = this;
		this.layers.push(layer);
		return this;
	}

	on(event: string, handler: (event: any) => void) {
		(this.listeners[event] ??= []).push(handler);
		return this;
	}

	// drive the handlers CropperArea registered
	fire(event: string, payload: any = {}) {
		(this.listeners[event] ?? []).forEach((handler) => handler(payload));
	}

	isDragging() { return this.dragging }
	getPointerPosition() { return this.pointer }
}

export const stages: FakeStage[] = []
export const layers: FakeLayer[] = []
export const images: FakeNode[] = []
export const rects: FakeNode[] = []

export function resetKonvaMock(): void {
	stages.length = 0;
	layers.length = 0;
	images.length = 0;
	rects.length = 0;
}

export const konvaMock = {
	hitOnDragEnabled: false,
	Stage: class extends FakeStage {
		constructor(config: Record<string, any> = {}) { super(config); stages.push(this) }
	},
	Layer: class extends FakeLayer {
		constructor(config: Record<string, any> = {}) { super(config); layers.push(this) }
	},
	Image: class extends FakeNode {
		constructor(config: Record<string, any> = {}) { super(config); images.push(this) }
	},
	Rect: class extends FakeNode {
		constructor(config: Record<string, any> = {}) { super(config); rects.push(this) }
	}
}

// the last stage/layer/rect created, i.e. the ones the component is using
export const lastStage = () => stages[stages.length - 1] as FakeStage
export const lastLayer = () => layers[layers.length - 1] as FakeLayer
export const lastImage = () => images[images.length - 1]
export const lastRect = () => rects[rects.length - 1]
