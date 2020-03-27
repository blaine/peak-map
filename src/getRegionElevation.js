import { MAPBOX_TOKEN } from "./config";
// import { rhumbDistance } from '@turf/turf';

export default function getRegionElevation(map, appState, doneCallback) {
  const progress = {}

  let heightsHandle;
  let isCancelled = false;

  computeVisibleHeights()
    .then(createAPI)
    .then(api => {
      if (!isCancelled) {
        doneCallback(api)
      }
    });

  return {
    cancel() {
      isCancelled = true;
      cancelAnimationFrame(heightsHandle);
    }
  }

  function createAPI(visibleHeights) {
    let width = visibleHeights.windowWidth;
    let windowWidth = visibleHeights.windowWidth;
    let windowHeight = visibleHeights.windowHeight;
    let allHeights = visibleHeights.allHeights;

    return {
      getHeightAtPoint,
      windowHeight,
      windowWidth,
      getAllHeightData() {
        return visibleHeights;
      }
    };

    function getHeightAtPoint(x, y) {
      return allHeights[x + y * width];
    }
  }

  function computeVisibleHeights() {
    progress.message = 'Computing elevation lines...';

    const gl = map.getCanvas().getContext('webgl');
    const dpr = window.devicePixelRatio || 1;
    var data = new Uint8ClampedArray(gl.drawingBufferWidth * dpr * gl.drawingBufferHeight * dpr * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth * dpr, gl.drawingBufferHeight * dpr, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const windowWidth = gl.drawingBufferWidth * dpr;
    const windowHeight = gl.drawingBufferHeight * dpr;
    let allHeights = new Float32Array(gl.drawingBufferWidth * dpr * gl.drawingBufferHeight * dpr);
    let done;

    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let rowWithHighestPoint = -1;

    heightsHandle = requestAnimationFrame(collectHeights); // todo let it be cancelled;

    return new Promise((resolve) => { done = resolve });

    function collectHeights() {

      // const origin = map.transform.pointLocation({x: Math.floor(windowWidth/2), y: 0});
      // const horizon = map.transform.pointLocation({x: 0, y: windowHeight});
      // const horizonDist = rhumbDistance([origin.lat, origin.lng], [horizon.lat, horizon.lng]);

      const heightAdjustAmount = Math.sin(map.transform._pitch);
      console.log(heightAdjustAmount);

      for (let y = 0; y < windowHeight; y++) {
        for (let x = 0; x < windowWidth; x++) {
          const index = (windowHeight - y) * windowWidth + x;
          let height = getHeight(x, y);
          // a very poor attempt at adjusting for perspective
          //
          // let pt = map.transform.pointLocation({x, y});
          // let dist = rhumbDistance([origin.lat, origin.lng], [pt.lat, pt.lng]);
          // let newheight = height - height * (dist/horizonDist);
          // if (x == Math.floor(windowWidth/2)) {
          //  console.log(x, y, dist, height, newheight);
          // }
          // height = newheight;
          let heightDiff = height - (height * ((windowHeight-y)/windowHeight));
          height = height - heightDiff * heightAdjustAmount;
          allHeights[index] = height;
          if (height < minHeight) minHeight = height;
          if (height > maxHeight) {
            maxHeight = height;
            rowWithHighestPoint = y;
          }
        }
      }

      let ret = {
        minHeight, maxHeight,
        rowWithHighestPoint,
        allHeights,
        windowWidth,
        windowHeight
      };

      done(ret);
    }

    function getHeight(x, y) {
      let index = (y * gl.drawingBufferWidth * dpr + x) * 4;
      let R = data[index + 0];
      let G = data[index + 1];
      let B = data[index + 2];
      let A = data[index + 3];

      return decodeHeight(R, G, B, A);
    }

    function decodeHeight(R, G, B, A) {
      let height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
      if (height < -100) {
        // Fiji islands data has huge caves, which pushes the entire thing up.
        // I'm reducing it.
        height = height / 5000;
      }
      return height * A;
    }
  }
}
