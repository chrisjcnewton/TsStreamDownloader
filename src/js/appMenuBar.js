// Load native UI library
var gui = require('nw.gui');

// Get the current window
var win = gui.Window.get();

// Create a menubar for window menu
var menubar = new gui.Menu({ type: 'menubar' });

if (process.platform === "darwin") {  // this should indicate you're on Mac OSX
  //menubar.createMacBuiltin(gui.App.manifest.description);
}

// Create a menuitem
var fileMenu = new gui.Menu();


fileMenu.append(new gui.MenuItem({
  type: 'normal',
  label: 'Check for new content',
  click: function () {
      gui.Window.get().close(true);
  }
}));

fileMenu.append(new gui.MenuItem({
  type: 'separator'
}));

fileMenu.append(new gui.MenuItem({
  type: 'normal',
  label: 'Exit',
  click: function () {
      gui.Window.get().close(true);
  }
}));

// You can have submenu!
menubar.append(new gui.MenuItem({ label: 'File', submenu: fileMenu}));

//assign the menubar to window menu
win.menu = menubar;
