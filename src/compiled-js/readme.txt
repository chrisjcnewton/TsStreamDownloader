==== Compiled JS ======

This code needs to be compiled as it has secret information in it. This can be done using the following command:

<path to nwjc>/nwjc ./src/compiled-js/compiled.js ./build/app-data/snapshot.bin

!! This needs to be run on every platform that the app supports for both 32-bit and 64-bit versions if necessary!!

Also the following line needs to be added to load the js code at runtime:

  var gui = require('nw.gui');
  gui.Window.get().evalNWBin(null, './app-data/snapshot.bin');
