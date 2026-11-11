// Every flag is loaded once and kept ready to draw.
const svgs = import.meta.glob("../../node_modules/flag-icons/flags/4x3/*.svg", {
  eager: true, query: "?raw", import: "default",
});

export const flags = {}; // code -> { url, image }

export const flagsReady = Promise.all(Object.entries(svgs).map(([file, svg]) => new Promise(done => {
  const code = file.match(/([\w-]+)\.svg$/)[1];
  // A stated size makes every browser willing to draw the SVG onto a canvas.
  const sized = /<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace("<svg", '<svg width="640" height="480"');
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    flags[code] = { url, image };
    done();
  };
  image.onerror = done;
  image.src = url;
})));
