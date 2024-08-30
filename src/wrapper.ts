export const ACTION = {
  NONE: 0,
  ROTATE: 1,
  TRUCK: 2,
  OFFSET: 4,
  DOLLY: 8,
  ZOOM: 16,
  TOUCH_ROTATE: 32,
  TOUCH_TRUCK: 64,
  TOUCH_OFFSET: 128,
  TOUCH_DOLLY: 256,
  TOUCH_ZOOM: 512,
  TOUCH_DOLLY_TRUCK: 1024,
  TOUCH_DOLLY_OFFSET: 2048,
  TOUCH_DOLLY_ROTATE: 4096,
  TOUCH_ZOOM_TRUCK: 8192,
  TOUCH_ZOOM_OFFSET: 16384,
  TOUCH_ZOOM_ROTATE: 32768,
} as const
type mouseButtonAction = typeof ACTION.ROTATE | typeof ACTION.TRUCK | typeof ACTION.OFFSET | typeof ACTION.DOLLY | typeof ACTION.ZOOM | typeof ACTION.NONE
type mouseWheelAction = typeof ACTION.ROTATE | typeof ACTION.TRUCK | typeof ACTION.OFFSET | typeof ACTION.DOLLY | typeof ACTION.ZOOM | typeof ACTION.NONE
type singleTouchAction = typeof ACTION.TOUCH_ROTATE | typeof ACTION.TOUCH_TRUCK | typeof ACTION.TOUCH_OFFSET | typeof ACTION.DOLLY | typeof ACTION.ZOOM | typeof ACTION.NONE
type multiTouchAction = typeof ACTION.TOUCH_DOLLY_ROTATE | typeof ACTION.TOUCH_DOLLY_TRUCK | typeof ACTION.TOUCH_DOLLY_OFFSET | typeof ACTION.TOUCH_ZOOM_ROTATE | typeof ACTION.TOUCH_ZOOM_TRUCK | typeof ACTION.TOUCH_ZOOM_OFFSET | typeof ACTION.TOUCH_DOLLY | typeof ACTION.TOUCH_ZOOM | typeof ACTION.TOUCH_ROTATE | typeof ACTION.TOUCH_TRUCK | typeof ACTION.TOUCH_OFFSET | typeof ACTION.NONE
// https://github.com/yomotsu/camera-controls/blob/271b04f060584afaea93e620ed11abc2c65b23d8/src/types.ts#L78-L83
// for some reason the package manager can't import the types from the `camera-controls` package
export interface MouseButtons {
  left: mouseButtonAction
  middle: mouseButtonAction
  right: mouseButtonAction
  wheel: mouseWheelAction
}
export const NO_MOUSE = {
  left: ACTION.NONE,
  middle: ACTION.NONE,
  right: ACTION.NONE,
  wheel: ACTION.NONE,
} as const

export interface Touches {
    one: singleTouchAction;
    two: multiTouchAction;
    three: multiTouchAction;
}

export const NO_TOUCH = {
  one: ACTION.NONE,
  two: ACTION.NONE,
  three: ACTION.NONE,
} as const
