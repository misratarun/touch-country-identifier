// Names for touches on water. The outlines are rough on purpose: land is
// checked first, so an outline only has to be right where it crosses open sea.
// Points are [longitude, latitude]. Seas are checked in order, before oceans.
const box = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n]];

export const WATERS = [
  { name: "Caspian Sea", ring: box(46.5, 36.5, 54.5, 47.2) },
  { name: "Black Sea", ring: box(27.5, 40.9, 41.8, 47.3) },
  { name: "Baltic Sea", ring: box(10.5, 53.5, 30.5, 66) },
  { name: "North Sea", ring: box(-4, 51, 10.5, 61) },
  { name: "Mediterranean Sea", ring: [[-5.6, 35], [-5.6, 37], [0, 39.5], [3, 43.8], [10, 44.6], [13, 46], [20, 42], [23, 41.2], [26.5, 41], [27, 37], [36.5, 37], [36.5, 31], [32, 30.8], [20, 30], [10, 33], [10, 36.5], [-2, 34.8]] },
  { name: "Red Sea", ring: [[32, 30.2], [35.5, 29.8], [39.5, 22], [43.8, 13], [43.3, 12.3], [41, 13.5], [36.5, 18.5], [34, 25.5]] },
  { name: "Persian Gulf", ring: [[47.5, 30.5], [51, 30.5], [57, 27.2], [56.3, 24], [51, 23.5], [47.5, 28]] },
  { name: "Arabian Sea", ring: [[43.5, 10.5], [51, 5], [77.5, 5], [77.5, 10], [72, 23], [66, 26.5], [56.5, 26.5], [43.5, 13.5]] },
  { name: "Bay of Bengal", ring: [[77.5, 5], [80, 15], [86, 22.5], [92, 23], [95, 16], [98, 8], [95, 5]] },
  { name: "South China Sea", ring: [[103, 1.5], [99.5, 13], [106, 22], [114, 23], [121, 25.5], [121, 18.5], [119.5, 11], [117, 7], [113, 2]] },
  { name: "Sea of Japan", ring: [[127.5, 34.5], [129, 39.5], [130.5, 43], [137, 46.5], [142, 52], [142.5, 46], [141.5, 43], [140.5, 38], [136.5, 35.5], [131.5, 33.5]] },
  // Crosses the date line: longitudes run past 180 instead of turning negative.
  { name: "Bering Sea", wrap: true, ring: [[162, 55], [162, 61], [180, 66], [192, 66], [203, 58], [200, 54.5], [180, 51.5], [166, 54]] },
  { name: "Hudson Bay", ring: [[-95.5, 51], [-76, 51], [-76, 58], [-78, 63], [-82, 66], [-88, 66.5], [-95.5, 62]] },
  { name: "Gulf of Mexico", ring: [[-98, 18], [-98, 31], [-82, 31], [-80.3, 25.2], [-83, 22.5], [-86.8, 21.4], [-90.5, 18]] },
  { name: "Caribbean Sea", ring: [[-87.5, 21.4], [-83, 22.5], [-74, 20.5], [-66, 18.8], [-60.5, 18], [-59.5, 13], [-61, 10], [-77, 7.5], [-84, 9], [-88.8, 15.5]] },
];

export const OCEANS = {
  arcticFrom: 66,     // this latitude and north
  southernFrom: -60,  // this latitude and south
  indian: [[20, -60], [147, -60], [147, -38], [142, -11], [131, -9], [120, -9.5], [114, -8], [105, -6.2], [102, -2], [95.5, 5.5], [98, 8], [100, 30], [20, 30]],
  atlantic: [[-95, 66], [-95, 50], [-82, 31], [-80.3, 25.2], [-74, 20.5], [-60.5, 18], [-59.5, 13], [-61, 10], [-70, -10], [-70, -52], [-67.5, -55.5], [-67.5, -60], [20, -60], [20, -34], [20, 5], [30, 31], [45, 45], [45, 66]],
  // Everything else is the Pacific.
};
