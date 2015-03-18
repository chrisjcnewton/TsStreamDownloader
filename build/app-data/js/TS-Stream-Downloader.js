var App = App || (function(){

  var isOnline = require('is-online');
  var fs = require('fs');
  var crypto = require('crypto');
  var gui = require('nw.gui');
  var algorithm = 'aes-256-ctr';

  var serverUrl = "http://localhost:8888/DLNA-SERVER/endpoint.html";


  var viewControllerArray = [];

  var _init = function(){
    // load in binary data
    //gui.Window.get().evalNWBin(null, './app-data/snapshot.bin');

    startViewController(new DownloadViewController());

  };



  var _loadContentView = function(pathToContent, readyCallback){
    fs.readFile(pathToContent, 'utf8', function(err, data) {
      if(!err){
        var parser = new DOMParser();
        var viewContentHTML = parser.parseFromString(data, "text/html");
        var viewContent = viewContentHTML.body.children[0];
        readyCallback(null, viewContent);
      }else{
        readyCallback(err, null);
      }
    });
  };

  var startViewController = function(viewController, reverse, extras){

    _loadContentView(viewController.viewContentPath, function(error, newContentNode){
      if(!error){
        var theExtras = extras? extras : {};
        var currentContent = document.querySelector('.viewContent');
        if(currentContent){
          var currentViewController = viewControllerArray.pop();

          theExtras.previousViewControllerName = currentViewController.viewControllerName;
          currentContent.style.transform = reverse? "translateX("+window.innerWidth+"px)" : "scale(0.8)";
          currentContent.addEventListener('transitionend',function onEnd(){
            document.body.removeChild(currentContent);
            currentViewController.destroy();
            currentViewController = null;
            currentContent.removeEventListener('transitionend',onEnd, false);
          },false);

          document.body.appendChild(newContentNode);

          if(reverse)newContentNode.style.zIndex = "-1";
          //viewContent.style.left = window.innerWidth+"px";
          newContentNode.style.transform = reverse? "scale(0.8)" : "translateX("+window.innerWidth+"px)";
          newContentNode.addEventListener('transitionend',function onEnd(){
            viewControllerArray.push(viewController)
            viewController.create(theExtras);
            newContentNode.removeEventListener('transitionend',onEnd, false);
          },false);
          newContentNode.offsetWidth;
          //viewContent.style.left = "0px";
          newContentNode.style.transform = reverse? "scale(1.0)" : "translateX(0px)";


        }else{
          document.body.appendChild(newContentNode);
          viewControllerArray.push(viewController);
          viewController.create(theExtras);
        }

      }else{
        console.log("Error loading viewContent");
      }

    });
  };

  var isNetworkConnected = function(callback){
    isOnline(callback);
  };

  var getItemFromStorage = function(key){
    var value = localStorage.getItem(key);
    if(value == "" || value == undefined){
      return value;
    }else{
      try{
        value = _decrypt(value);
      }catch(e){
        console.log("DECRYPT ERROR");
      }
      return value;
    }

  };

  var setItemToStorage = function(key, value){
    var valToStore = (value == "")? value : _encrypt(value);
    localStorage.setItem(key,valToStore);
  };

  var _encrypt = function (text){
    var cipher = crypto.createCipher(algorithm, AppConstants.localEncryptionKey)
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
  };

  var _decrypt = function(text){
    var decipher = crypto.createDecipher(algorithm, AppConstants.localEncryptionKey)
    var dec = decipher.update(text,'hex','utf8')
    dec += decipher.final('utf8');
    return dec;
  };



  var readJsonFromDisk = function(jsonPath, callback){
    var error;
    fs.exists(jsonPath, function (exists) {
      if(exists){

        fs.readFile(jsonPath, function (err, jsondata) {
          if (err){
             error = {status:jsonPath+" : Error reading json from disk"};
             callback(error, null);
          }else{
            var jsonObj;
            try{
              jsonObj = JSON.parse(jsondata);
              callback(null, jsonObj);
            }catch(e){
              error = {status:jsonPath+" : Error parsing json"};
              callback(error, null);
            }
          }
        });

      }else{
        // File does not exist
        callback(null, null);
      }
    });
  };


  window.addEventListener('load', _init, false);

  return{
    serverUrl:serverUrl,
    isNetworkConnected:isNetworkConnected,
    startViewController:startViewController,
    getItemFromStorage:getItemFromStorage,
    setItemToStorage:setItemToStorage,
    readJsonFromDisk:readJsonFromDisk,

  }
})();

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

var AppUpdater = AppUpdater || function(options){

  var request = require('request');
  var fs = require('fs');
  var semver = require('semver');
  var ncp = require('ncp').ncp;
  var gui = require('nw.gui');
  var rimraf = require('rimraf');
  var mkdirp = require('mkdirp');

  var UPDATE_ZIP_NAME = options.zipName;
  var UPDATE_FOLDER_NAME = options.srcFolderName;
  var UPDATE_DEST_FOLDER_NAME = options.destFolderName;
  var appDataPath = gui.App.dataPath + "/";

  var NO_UPDATE = "No Update Available";
  var UPDATE_AVAILABLE = "Update Available";
  var UPDATE_SUCCESSFUL = "Update Successful";

  var dialog;
  var updateCallback;
  var fileDownloadTask;
  var downloadStarted = false;
  var downloadErrorOccurred = false;
  var zipErrorOccurred = false;
  var updateAppliedSuccessfully = false;
  var isAppUpdate = false;
  var appUpdateRemoteJson;

  var checkForAppUpdate = function(callback){
    updateCallback = callback;
    var currentVersion = gui.App.manifest.version;
    var updateUrl = gui.App.manifest.updateUrl;

    request(updateUrl, function (error, response, data) {
      if (!error && response.statusCode == 200) {
        appUpdateRemoteJson = JSON.parse(data);
        if(semver.gt(appUpdateRemoteJson.version, currentVersion)){
          updateCallback(UPDATE_AVAILABLE, null);
        }else{
          updateCallback(NO_UPDATE, null);
        }
      }else if(error){
        updateCallback(null, error);
        //console.log("Error Connecting to Server = "+error);
      }

    });
  };

  var downloadAppUpdate = function(){
    isAppUpdate = true;
    _launchDownloadDialog(appUpdateRemoteJson.updateContentsZip, "The Knowledge Version "+appUpdateRemoteJson.version+" is available.<br>Would you like to update the App?", true);
  };

  var downloadContentUpdate = function(updateUrl, message, callback){
    isAppUpdate = false;
    updateCallback = callback;
    _launchDownloadDialog(updateUrl, message, true);
  };

  var downloadInitialContent = function(updateUrl, message, callback){
    isAppUpdate = false;
    updateCallback = callback;
    _launchDownloadDialog(updateUrl, message, false, "DOWNLOAD");
  };

  var _launchDownloadDialog = function(updateUrl, message, showCancelBut, theconfirmCopy){

    dialog = new Dialog(message, {confirmCopy:theconfirmCopy? theconfirmCopy:"OK", cancelCopy:"Cancel", showConfirm:true, showCancel:showCancelBut,showProgress:false}, function(confirmed){

      if((confirmed && !downloadStarted) || (confirmed && downloadStarted && downloadErrorOccurred)){
          downloadStarted = true;
          dialog.toggleProgress();
          dialog.toggleConfirmButton();
          dialog.updateMessage("DOWNLOADING CONTENT");
          if(showCancelBut)dialog.toggleCancelButton();
          if(fileDownloadTask) fileDownloadTask = null;
          fileDownloadTask = new FileDownloader(updateUrl,  appDataPath + UPDATE_ZIP_NAME, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);

      }else if(confirmed && downloadStarted && !downloadErrorOccurred && !zipErrorOccurred && updateAppliedSuccessfully){
        console.log("Restart App");
        if(isAppUpdate){
          gui.App.quit();
        }else{
          dialog.hide();
          dialog = null;
          updateCallback(UPDATE_SUCCESSFUL, null);
        }
      }
      else if(!confirmed || (confirmed && zipErrorOccurred) ){
        dialog.hide();
        dialog = null;
        updateCallback(NO_UPDATE, null);
      }

    }, function(isPaused){
      // console.log("pauseClicked = "+pauseClicked);
      if(isPaused){
        // cancel the download
        fileDownloadTask.cancel();
      }else{
        // start the download from where we left off
        if(fileDownloadTask) fileDownloadTask = null;
        fileDownloadTask = new FileDownloader(updateUrl,  appDataPath + UPDATE_ZIP_NAME, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
      }
    });
  };

  var _onFileDownloadError = function(error){
    downloadErrorOccurred = true;
    dialog.updateMessage("There was a problem downloading the update.<br>("+error.message+")<br>Would you like to try again?");
    dialog.toggleProgress();
    dialog.toggleCancelButton();
    dialog.toggleConfirmButton();
    dialog.updateConfirmCopy("Try Again");
  }

  var _onFileDownloadProgress = function(amountDownloaded, totalAmount){
    var updateCopy = amountDownloaded+"mb / "+totalAmount+"mb";
    dialog.updateProgressMessage(updateCopy);
    var percentageDownLoaded = (amountDownloaded / totalAmount) * 100;
    dialog.updateProgress(percentageDownLoaded);
  }

  var _onFileDownloaded = function(downloadedFile, error){
    console.log(error);
    if((error && error.message != 'paused') ){
      downloadErrorOccurred = true;
      dialog.toggleProgress();
      dialog.toggleCancelButton();
      dialog.updateMessage(error.message);
    }else if(error && error.message == 'paused'){
      return;
    }
    else{
      downloadErrorOccurred = false;
      dialog.updateProgress("indeterminate");
      dialog.updateProgressMessage("");
      dialog.updateMessage("UNZIPPING CONTENT");
      dialog.toggleResumePauseButton();



      fs.exists(appDataPath + UPDATE_FOLDER_NAME, function (exists) {
        if(!exists) fs.mkdirSync(appDataPath + UPDATE_FOLDER_NAME);

        new UnzipFile(downloadedFile.path, appDataPath + UPDATE_FOLDER_NAME, _onFilesUnzipped, function(error){
          zipErrorOccurred = true;
          dialog.updateMessage("There was a problem unzipping the update.<br>("+error.message+")<br>Please try again later");
          dialog.toggleProgress();
          dialog.toggleConfirmButton();

          // Delete the zip file
          fs.unlink(appDataPath + UPDATE_ZIP_NAME, function (err) {
            if (err) throw err;
            console.log('successfully deleted zip');
          });

        });
      });


    }
  }

  var _onFilesUnzipped = function(){
    console.log('====== _onFilesUnzipped called');

    ncp.limit = 16;

    fs.exists(UPDATE_DEST_FOLDER_NAME, function (exists) {
      if(!exists) mkdirp.sync(UPDATE_DEST_FOLDER_NAME);

      // Copy over the old files with the new ////

      ncp(appDataPath + UPDATE_FOLDER_NAME, UPDATE_DEST_FOLDER_NAME, function (err) {
         if (err) {
           console.log("copy files error = "+err);
         }else{
           //dialog.updateProgressMessage("Files copied over original");
           console.log('Files Copied!');

           // Delete the zip file
           fs.unlink(appDataPath + UPDATE_ZIP_NAME, function (err) {
             if (err) {
                console.log("delete zip error: "+err);
                return;

             }else{
               console.log('successfully deleted update.zip');
               //dialog.updateProgressMessage("Zip Deleted");

               // Delete the temp folder
               rimraf(appDataPath + UPDATE_FOLDER_NAME, function(err) {
                  if (err) {
                    console.log("rimraf error: "+err);
                    //throw err;
                  }else{
                    updateAppliedSuccessfully = true;

                    console.log('Folder deleted '+UPDATE_FOLDER_NAME);

                    var updateMessage = isAppUpdate? "The Knowledge App has been updated<br>Click Close App and restart." : "The content has been installed";

                    dialog.updateMessage(updateMessage);
                    dialog.toggleProgress();
                    dialog.updateConfirmCopy("OK");
                    dialog.toggleConfirmButton();
                    if(isAppUpdate) dialog.updateConfirmCopy("Close App");
                  }
                });
              }
           });
         }

       });


    });

  }

  return{
    checkForAppUpdate:checkForAppUpdate,
    downloadAppUpdate:downloadAppUpdate,
    downloadContentUpdate:downloadContentUpdate,
    downloadInitialContent:downloadInitialContent,
    NO_UPDATE:NO_UPDATE,
    UPDATE_AVAILABLE:UPDATE_AVAILABLE,
    UPDATE_SUCCESSFUL:UPDATE_SUCCESSFUL
  }
};

var FileDownloader = FileDownloader || function(remoteFileUrl, targetFilePath, downloadingCallBack, onCompleteCallback, onErrorCallback){

  var request = require('request');
  var fs = require('fs');

  var BYTES_IN_MEGABYTE = 1024 * 1024;
  var len, cur, total;
  var userInitiatedCancel = false;
  var amountPreviouslyDownloaded = 0;
  var theDownloadedFile;
  var totalSizeOfFile;
  var req;
  var nothingToDownload = false;
  var dppError = false;
  var dppErrorBody = "";

  fs.stat(targetFilePath, function(err, stats){
    if(err){
      // file does not exist
      theDownloadedFile = fs.createWriteStream(targetFilePath);
      makeFileRequest();
    }else{
      amountPreviouslyDownloaded = stats.size;
      theDownloadedFile = fs.createWriteStream(targetFilePath, {'flags':'a'}); // Append content to the download
      makeFileRequest();

    }
  });

  console.log("url = "+remoteFileUrl);


  function makeFileRequest(){
    theDownloadedFile.remoteUrl = remoteFileUrl;
    var theUrl = remoteFileUrl;
    req = request({
        method: 'GET',
        uri: theUrl,
        headers:{
          'Range': "bytes="+amountPreviouslyDownloaded+"-"
        }
    });

    req.pipe(theDownloadedFile);

    req.on( 'response', function ( data ) {
        console.log(data);
        var contentType = data.headers['content-type'];
        console.log(contentType);
        if((contentType != "application/octet-stream" || contentType != "application/zip") && contentType == "text/html"){
          dppError = true;
        }
        len = parseInt(data.headers['content-length'], 10);
        cur = 0;
        total = len / BYTES_IN_MEGABYTE;
        if(isNaN(len)){
          nothingToDownload = true;
          req.abort();
        }

    });

    req.on('data', function (chunk)
    {
        if(!dppError){
          cur += chunk.length;
          var amountDownloaded = (cur / BYTES_IN_MEGABYTE);
          var totalAmountDownloaded = (amountPreviouslyDownloaded === 0)? amountDownloaded : (amountPreviouslyDownloaded / BYTES_IN_MEGABYTE) + amountDownloaded;
          var totalAmount = (amountPreviouslyDownloaded === 0)? total : (amountPreviouslyDownloaded / BYTES_IN_MEGABYTE) + total;

          downloadingCallBack(Math.floor(totalAmountDownloaded), Math.floor(totalAmount));
        }else{
          dppErrorBody += chunk;
        }
    });


    req.on('end', function()
    {
        var error = null;
        if(nothingToDownload){
          console.log("FileDownloader: File already Downloaded");
        }else if(userInitiatedCancel){
          error = {'message':'paused'};
        }else if(dppError){
          error = {'message':dppErrorBody};
          console.log(dppErrorBody);
        }
        onCompleteCallback(theDownloadedFile, error);
    });

    req.on("error", function(e){
        console.log(e);
        onErrorCallback(e);
    });
  }



  function onCancel(){
    userInitiatedCancel = true;
    req.abort();
  }

  return{
    cancel:onCancel
  }

};

var AppContentViewController = AppContentViewController || function(){

  var viewContentPath = './app-data/appContent.html';
  var viewControllerName = "AppContentViewController";
  var previousViewControllerName;

  var request = require('request');
  var fs = require('fs');
  var gui = require('nw.gui');

  var JSON_URL = DHLApp.serverBaseUrl + DHLApp.issuesJsonUrl;
  //var JSON_URL = "http://172.27.164.158:8888/DHL-DPP-SERVER/service/region/233/issues.json";
  //var jsonFilename = "update.json";
  var contentIframe;
  var subLevelNav;
  var searchIndexer;
  var searchBox;
  var searchResults;
  var breadcrumbs;
  var menuJsonObj;
  var iframeResizeTimeout;

  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;

    contentIframe = document.querySelector('#contentIFrame');
    window.addEventListener('resize', _onResize, false);
    _loadContent();
  };

  var _loadContent = function(){
    DHLApp.readJsonFromDisk(DHLApp.appContentDataPath + DHLApp.menuJsonName, function(error, jsonObj){//menu3.json
      if(error){
        console.log(error.status);
      }else if(jsonObj){
        var homeLogoButton = document.querySelector('#mainContentMenu #knowledgeLogo');
        homeLogoButton.onclick = function(){
          //_clearMenuHighlights();
          _hideSubMenu();
          _clearItemsFromSubMenu();
          if(breadcrumbs) breadcrumbs.innerHTML = "";
          _updateIframe(DHLApp.appContentDataPath + jsonObj.landing);
        };
        // Generate Menu
        _generateMenu(jsonObj);

        // Load the content
        _updateIframe(DHLApp.appContentDataPath + jsonObj.landing);

      }else{
        // Download the content
        console.log("File does not exist");
        //_downloadInitialContent();
        DHLApp.startViewController(new ContentDownloadViewController());
      }
    });
  };

/////// Main Menu Generation ///////////

  var _generateMenu = function(menuObj){
    menuJsonObj = menuObj;

    searchBox = document.querySelector('#mainContentMenu #searchBox');
    searchResults = document.querySelector('#searchResults');
    searchResults.addEventListener('transitionend', _onSearchTransEnd,false);
    var searchCloseButton = document.querySelector('#searchResults #searchCloseButton');
    searchCloseButton.onclick = _onSearchClosed;
    searchBox.addEventListener('keyup', _onSearchKeyUp, false);
    searchIndexer = new SearchIndexBuilder();
    searchIndexer.updateIndex(DHLApp.appContentDataPath + 'searchIndex.json');

    var topLevelNav = document.querySelector('#mainContentMenu #topLevelNav');
    subLevelNav = document.querySelector('#mainContentMenu #subLevelNav');



    breadcrumbs = document.querySelector('#breadcrumbs');

    //console.log("currentPath = ",_getBreadcrumbPath(menuJsonObj.sections, {},"User Guide") );

    var menuSections = menuJsonObj.sections;

    for(var i=0; i< menuSections.length; i++){
      var navItem = document.createElement('li');

      if(menuSections[i].hasOwnProperty('pages') ){
        //navItem.isMenu = true;
        //navItem.onclick = _onNavItemClicked;
        //navItem.onmouseover = _showSubMenu;
        navItem.onclick = _onTopMenuItemClicked;
        //navItem.onmouseout = _hideSubMenu;
        navItem.pages = menuSections[i].pages;
      }else{
        navItem.onclick = _onNavItemClicked;
      }

      navItem.innerHTML = menuSections[i].title;
      navItem.menuObj = menuSections[i];
      topLevelNav.appendChild(navItem);
    }

    var mainContentMenu = document.querySelector('#mainContentMenu');
    mainContentMenu.classList.add('show');
    searchResults.classList.add('show');


  };

  var _onTopMenuItemClicked = function(e){
    var menuItem = this;
    if(menuItem.classList.contains('highlighted')){
      _onNavItemClicked.call(menuItem, e);
    }else{
      _showSubMenu.call(menuItem, e);
    }
  };

  var _addItemsToSubMenu = function(pages, elem){

    elem.setAttribute('class', 'subItemList');

    for(var j=0; j< pages.length; j++){
      if(pages[j].hasOwnProperty('pages')){
        var subNavTitleItem = document.createElement('li');
        subNavTitleItem.setAttribute('class', 'subNavTitleItem');
        subNavTitleItem.menuObj = pages[j];
        subNavTitleItem.onclick = _onNavItemClicked;
        //subNavTitleItem.isMenu = true;
        subNavTitleItem.innerHTML = pages[j].title;

        var subItemList = document.createElement('span');
        subItemList.appendChild(subNavTitleItem);
        _addItemsToSubMenu( pages[j].pages, subItemList );
      }else{
        var subNavItem = document.createElement('li');
        subNavItem.setAttribute('class', 'subLevelLink');
        subNavItem.innerHTML = pages[j].title;
        subNavItem.menuObj = pages[j];
        subNavItem.onclick = _onNavItemClicked;
        elem.appendChild(subNavItem);
      }
    }
    subLevelNav.appendChild(elem);
  };


  var _onNavItemClicked = function(e){
    var currentLink = this;
    _updateIframe(DHLApp.appContentDataPath + currentLink.menuObj.path);

    var breadCrumbArray = _getBreadcrumbPath(menuJsonObj.sections, {}, currentLink.menuObj.path);
    //var breadCrumbArray = _getBreadCrumbPathOnClick.call(this, e);
    breadcrumbs.innerHTML = "";

    for(var i=0; i< breadCrumbArray.length; i++){

      var bcTitle = breadCrumbArray[i].title;
      var breadcrumb = document.createElement('div');
      breadcrumb.setAttribute('class', 'breadcrumb');
      breadcrumb.innerHTML = bcTitle;
      breadcrumb.menuObj = breadCrumbArray[i];
      if(breadCrumbArray[i].path && i!=breadCrumbArray.length-1){
        breadcrumb.onclick = _onNavItemClicked;
        breadcrumb.style.cursor = 'pointer';
      }
      breadcrumbs.appendChild(breadcrumb);

      if(i!=breadCrumbArray.length-1){
        var separator = document.createElement('span');
        separator.innerHTML = " > ";
        breadcrumbs.appendChild(separator);
      };
    }

    _highlightCurrentPageOnMenu();

  };

  var _showSubMenu = function(e){
    _hideSubMenu();
    _clearItemsFromSubMenu();
    var subItemList = document.createElement('span');
    _addItemsToSubMenu(e.target.pages, subItemList);

    var closeButton = new Image();
    closeButton.classList.add('subLevelNavClose');
    closeButton.src = 'images/close-button.png';
    closeButton.onclick = _highlightCurrentPageOnMenu;
    subLevelNav.appendChild(closeButton);

    var clear = document.createElement('div');
    clear.style.clear = 'both';
    subLevelNav.appendChild(clear);
    e.target.classList.add('highlighted');
    subLevelNav.classList.add('show');


  };

  var _highlightCurrentPageOnMenu = function(){
    var topLevelNavItems = document.querySelectorAll('#topLevelNav li');
    var currentBreadCrumbs = breadcrumbs.innerHTML.toUpperCase();

    _hideSubMenu();
    if(currentBreadCrumbs != ""){
      var currentActive = currentBreadCrumbs.split(' &GT; ')[0];
      for(var i=0; i< topLevelNavItems.length; i++){
        if(currentActive == topLevelNavItems[i].innerHTML.toUpperCase()){
          topLevelNavItems[i].classList.add('currentActive');
        }
      }
    }
  };

  var _clearMenuHighlights = function(){
    var topLevelNavItems = document.querySelectorAll('#topLevelNav li');
    for(var i=0; i< topLevelNavItems.length; i++){
      topLevelNavItems[i].classList.remove('highlighted');
      topLevelNavItems[i].classList.remove('currentActive');
    }
  };

  var _hideSubMenu = function(){
    _clearMenuHighlights();
    subLevelNav.style.transition = "none";
    subLevelNav.classList.remove('show');
    subLevelNav.offsetHeight;
    subLevelNav.style.transition = "opacity 0.3s ease-in-out";
  };

  var _clearItemsFromSubMenu = function(){
    subLevelNav.innerHTML = "";
  };



///////// Updating IFRAME //////////


  var _updateIframe = function(path){
    contentIframe.onload = _onIframeLoaded;
    contentIframe.style.transition = "none";
    contentIframe.style.opacity = "0";
    contentIframe.offsetHeight;
    contentIframe.style.transition = "opacity 0.6s ease-in-out";
    contentIframe.src = path;
  };

  var _onIframeLoaded = function(){
    var iframeAnchorTags = contentIframe.contentWindow.document.querySelectorAll('a');
    for(var i=0; i< iframeAnchorTags.length; i++){
      if(iframeAnchorTags[i].hasAttribute('href')){
        iframeAnchorTags[i].onclick = _onInterceptUrlRequest;
      }
      iframeAnchorTags[i].style.outline = 'none';
    }
    contentIframe.contentWindow.document.body.style.overflow = 'hidden';

    var section = contentIframe.contentWindow.document.querySelector('section');
    var appContentView = document.querySelector('.appContentView');
    if(section.getAttribute('data-bg') != undefined){
      appContentView.style.backgroundColor = "black";
      breadcrumbs.classList.add('white');
    }else{
      appContentView.style.backgroundColor = "white";
      breadcrumbs.classList.remove('white');
    }


    var versionInfoArea = contentIframe.contentWindow.document.querySelector('.version-content');
    if(versionInfoArea){
      // get current version date
      _checkForUpdate(function(versionsObj){
        versionInfoArea.children[0].children[0].innerHTML += versionsObj.remoteDate? ' '+versionsObj.remoteDate : " Server not available";
        versionInfoArea.children[1].children[0].innerHTML += ' '+versionsObj.localDate;
      });
    }

    var springboardAccordians = contentIframe.contentWindow.document.querySelectorAll('.springboard-accordion');
    if(springboardAccordians){
      for(var j=0; j< springboardAccordians.length; j++){
        springboardAccordians[j].addEventListener('click', _onAccordianClicked, false);
      }
    }

    _onResize();
    contentIframe.style.opacity = "1";
  };

  var _onAccordianClicked = function(e){
    console.log('acc clicked');
    setTimeout(_onResize,100);
  };

  var _onInterceptUrlRequest = function(e){
    e.preventDefault();
    var urlRequest = this.href;
    var protocol = this.protocol;
    console.log("protocol = "+protocol);
    console.log("this.protocol = "+this.protocol);
    console.log("this.hostname = "+this.hostname);
    console.log("this.pathname = "+this.pathname);

    if(protocol === 'update:'){
      _checkForUpdate();
    }else if(protocol === 'http:' || protocol === 'https:'){
      gui.Shell.openExternal(urlRequest);
    }else if(protocol === 'tablet:'){
      console.log(menuJsonObj);


      var internalPath = this.pathname.substring(1);
      console.log("internalPath = "+internalPath);
      console.log("menuJsonObj = "+menuJsonObj.sections);

      var pagePath = _getPagePath(menuJsonObj.sections, internalPath);

      console.log("pagePath = "+pagePath);

      var internalLink = {};
      internalLink.menuObj = {};
      internalLink.menuObj.path = pagePath;
      _onNavItemClicked.call(internalLink, null);
      

    }

  };

  var _onResize = function(){
    clearTimeout(iframeResizeTimeout);
    iframeResizeTimeout = setTimeout(function(){
      if(contentIframe){
        contentIframe.style.height = "1px";
        contentIframe.style.offsetHeight;
        contentIframe.style.height = contentIframe.contentWindow.document.body.scrollHeight + 'px';
      }
    }, 100);
  };

///// Checking for Content Update ///////////

  var _checkForUpdate = function(updateCallback){

    DHLApp.readJsonFromDisk(DHLApp.appDataPath+DHLApp.updateJsonName, function(error, jsonObj){
      if(error){
        console.log(error.status);
      }else if(jsonObj){
        //console.log(jsonObj);

        var localJsonData = jsonObj

        request(DHLApp.addSecurityQueryString(JSON_URL), function (error, response, data) {
          if (error) {
            // Can't connect to Server So no updates available
            //console.log("Can't reach the server "+error);
            if(updateCallback){
              var versionsObj = {};
              versionsObj.localDate = DHLApp.convertTimestampToDate( localJsonData.items[0].date );
              versionsObj.remoteDate = null;
              updateCallback(versionsObj);
            }else{
              var errorDialog = new Dialog("Can't connect to server, check your internet connection", {confirmCopy:"OK"}, function(){
                errorDialog.hide();
                errorDialog = null;
              });
            }
          }else{
            var remoteJsonData = JSON.parse(data);
            //console.log(remoteJsonData);

            if(updateCallback){
              var versionsObj = {};
              versionsObj.localDate = DHLApp.convertTimestampToDate( localJsonData.items[0].date );
              versionsObj.remoteDate = DHLApp.convertTimestampToDate( remoteJsonData.items[0].date );
              updateCallback(versionsObj);
            }else{
              if(remoteJsonData.items[0].date !== localJsonData.items[0].date){
                // if date is not the same on remote json then there is an update available so download the zip
                console.log("An update is available");
                var zipUrl = remoteJsonData.items[0].issueurl;//deltaupdateurl
                _downloadZipFile(zipUrl, data);
              }else{
                console.log("NO update available");
                var uptoDateDialog = new Dialog("Your content is up to date", {confirmCopy:"OK"}, function(){
                  uptoDateDialog.hide();
                  uptoDateDialog = null;
                });
              }
            }
          }
        });

      }
    });

  };


  var _downloadZipFile = function(zipUrl, remoteJsonData, message){
    console.log("download this file "+zipUrl);
    var theMessage;
    if(!message){
      theMessage = "An update to the DHL Knowledge Content is available.<br>Click OK to update"
    }else{
      theMessage = message;
    }

    var updater = new AppUpdater({zipName:"content_update.zip", srcFolderName:"content_update", destFolderName:DHLApp.appContentDataPath});
    updater.downloadContentUpdate(zipUrl, theMessage, function(message, error){
      if(error){

      }else{
        if(message === updater.UPDATE_SUCCESSFUL){
          console.log(updater.UPDATE_SUCCESSFUL);
          // Update successful so write the json to disk for next time
          fs.exists(DHLApp.appDataPath, function (exists) {
            if(!exists) fs.mkdirSync(DHLApp.appDataPath);
            fs.writeFile(DHLApp.appDataPath+DHLApp.updateJsonName, remoteJsonData, "utf-8", function(err){
              if(err) console.log("Error writing json to disk");
            });
          });
          //updateButton.removeAttribute('disabled');
          //_loadContent();
          DHLApp.startViewController(new AppContentViewController());

        }else if(message === updater.NO_UPDATE){
          console.log(updater.NO_UPDATE);
          //updateButton.removeAttribute('disabled');
        }
      }
    });
  };

  var _onSearchKeyUp = function(){
    var results = searchIndexer.search(searchBox.value);
    var searchResultsList = document.querySelector('#searchResults ul');
    var searchTitle = document.querySelector('#searchResults #searchTitle');
    if(results.length > 0){
      searchTitle.innerHTML = results.length +" Result(s)";
      searchResults.style.display = "block";
      searchResults.offsetHeight;
      searchResults.classList.add('expand');
      searchResultsList.innerHTML = "";
      for(var i=0; i< results.length; i++){
        var searchResult = document.createElement('li');
        var breadCrumbArray = _getBreadcrumbPath(menuJsonObj.sections, {}, results[i].path);
        if(breadCrumbArray.length > 0){
          var breadCrumb = "";
          for(var j=0; j< breadCrumbArray.length; j++){
            breadCrumb += (j==breadCrumbArray.length-1)? breadCrumbArray[j].title : breadCrumbArray[j].title + " > ";
          }
          searchResult.innerHTML = "<span class='searchBreadCrumb'>"+breadCrumb+"</span><br><span class='searchResultTitle'>"+results[i].title+"</span>";
        }else{
          searchResult.innerHTML = results[i].title;
        }
        searchResult.menuObj = results[i];
        searchResult.onclick = function(e){
          _onNavItemClicked.call(this, e);
          //_highlightCurrentPageOnMenu();
        };
        searchResultsList.appendChild(searchResult);
      }
    }else{
      searchResults.classList.remove('expand');
    }
  };

  var _onSearchClosed = function(){
    searchResults.classList.remove('expand');
  };

  var _onSearchTransEnd = function(){
    if(!searchResults.classList.contains('expand')){
      searchResults.style.display = "none";
    }
  };
/*
  var _getBreadCrumbPathOnClick = function(e){
    console.log("s"+ this.tagName);

    var breadCrumbsArray = [];

    if(this.tagName === 'LI'){
      // a menu item was clicked
      var topLevelNavItems = document.querySelectorAll('#topLevelNav li');
      for(var i=0; i< topLevelNavItems.length; i++){
        if(topLevelNavItems[i].classList.contains('highlighted')){
          breadCrumbsArray.push( topLevelNavItems[i].menuObj );
        }
      }
      var subNavTitle = this.parentNode.querySelector('.subNavTitleItem');

      if(subNavTitle && !this.classList.contains('subNavTitleItem')){
        breadCrumbsArray.push( subNavTitle.menuObj );
      }

      if(!this.classList.contains('highlighted')){
        breadCrumbsArray.push( this.menuObj );
      }

    }else if(this.tagName === 'DIV'){
      // a breadcrumb item was clicked
      var breadcrumbs = this.parentNode.children;
      for(var j=0; j< breadcrumbs.length; j++){
        if(breadcrumbs[j].classList.contains('breadcrumb') ){
          breadCrumbsArray.push( breadcrumbs[j].menuObj );
          if(this.menuObj.title == breadcrumbs[j].menuObj.title) break;
        }
      }
    }
    return breadCrumbsArray;

  };

*/
  var _getBreadcrumbPath = function(arr, parentObj, pathToFind){

    for(var x=0; x<arr.length; x++){

      if(arr[x].path === pathToFind){
        var currentPath = [];
        if(parentObj && parentObj.pObj && parentObj.pObj.title) currentPath.push(parentObj.pObj);
        if(parentObj && parentObj.title) currentPath.push(parentObj);
        currentPath.push(arr[x]);
        return currentPath;

      }else if(arr[x].hasOwnProperty('pages')){
        arr[x].pObj = parentObj;
        var result = _getBreadcrumbPath(arr[x].pages, arr[x], pathToFind);
        if( result ){
          return result;
        }
      }
    }
    return false;
  };

  var _getPagePath = function(arr, originalPath){

    for(var i=0; i<arr.length; i++){
      if(arr[i]['original-path'] === originalPath){
        return arr[i].path;
      }else if(arr[i].hasOwnProperty('pages')){
        var result = _getPagePath(arr[i].pages, originalPath);
        if(result) return result;
      }
    }
    return false;
  };


  var destroy = function(){
    // Remove event listeners and null out objects here
    window.removeEventListener('resize', _onResize, false);
    if(searchResults) searchResults.removeEventListener('transitionend', _onSearchTransEnd,false);
    if(searchBox) searchBox.removeEventListener('keyup', _onSearchKeyUp, false);
  };

  return {
    viewContentPath:viewContentPath,
    viewControllerName:viewControllerName,
    create:create,
    destroy:destroy
  };
};

var DownloadViewController = DownloadViewController || function(){

  var viewContentPath = './app-data/download.html';
  var viewControllerName = "DownloadViewController";
  var previousViewControllerName;

  var request = require('request');
  var fs = require('fs');
  var gui = require('nw.gui');

  var appDataPath = gui.App.dataPath + "/";
  //var cwd = process.cwd();
  var urlJsonName = "urls.json";

  var currentJsonUrlObj;


  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;


    _getCurrentUrls();

  };


  var _getCurrentUrls = function(){
    App.readJsonFromDisk(appDataPath + urlJsonName, function(error, jsonObj){
      if(error){
        console.log(error.status);
      }else{
        if(jsonObj){
          currentJsonUrlObj = jsonObj;
        }else{
          // Download the content
          console.log("File does not exist");
          currentJsonUrlObj = null;
        }

        _getDlnaUrls(function(error, remoteJsonUrlObj){
          if(!error){

            if(currentJsonUrlObj){
              var localUrlArr = currentJsonUrlObj.urls;
              var remoteUrlArr = remoteJsonUrlObj.urls;

              _compareJSON(localUrlArr, remoteUrlArr, function(downloadArray, deleteArray){
                if(downloadArray.length == 0 && deleteArray.length == 0){
                  console.log("No Changes on Server");
                }
                else{
                  if(deleteArray.length > 0){
                    console.log("deleteArray = ",deleteArray);
                    // Delete some files
                    for(var i=0; i< deleteArray.length; i++){
                      var fileName = deleteArray[i].mediaurl.split('/')[4];
                      try{
                        fs.unlinkSync(appDataPath + fileName);
                        _deleteFromArray(currentJsonUrlObj.urls, deleteArray[i].mediaurl);
                      }catch(e){
                        _deleteFromArray(currentJsonUrlObj.urls, deleteArray[i].mediaurl);
                        console.log("couldn't find file "+appDataPath + fileName+" but deleted it from json anyway");
                      }
                    }
                    _writeJsonToDisk(currentJsonUrlObj);
                  }
                  if(downloadArray.length > 0){
                    _downloadMediaFiles(downloadArray);
                  }
                }
              });

            }else{
              // First run so download everything
              _downloadMediaFiles(remoteJsonUrlObj.urls);

            }

          }else{
            console.log("Error Connecting to Server = "+error);
          }

        });


      }
    });
  };

  var _writeJsonToDisk = function(jsonObj){
    var jsonRaw = JSON.stringify(jsonObj);
    var outputFilename = appDataPath + urlJsonName;
    fs.writeFile(outputFilename, jsonRaw, function(err) {
        if(err) {
          console.log(err);
        } else {
          console.log("JSON saved to " + outputFilename);
        }
    });
  };


  var _getDlnaUrls = function(callback){
    request(App.serverUrl, function (error, response, data) {

      if (!error && response.statusCode == 200) {
        //console.log(response.body);

        var parser = new DOMParser();
        var viewContentHTML = parser.parseFromString(response.body, "text/html");
        var viewContent = viewContentHTML.body.children[0];
      //console.log(viewContent);
        var dlnaElems = viewContent.querySelectorAll('.entry');
        var dlnaElemsJsonObj = {};
        dlnaElemsJsonObj.urls = [];
        for(var i=0; i< dlnaElems.length; i++){
          dlnaElemsJsonObj.urls.push( {"mediaurl":dlnaElems[i].innerHTML} );
        }
        callback(null, dlnaElemsJsonObj);
        //console.log("dlnaElemsJsonObj ",dlnaElemsJsonObj);
        //console.log(JSON.stringify(dlnaElemsJsonObj));

      }else if(error){
        callback(error, null);
      }

    });
  };







  var _downloadMediaFiles = function(downloadArr){

    for(var i=0; i< downloadArr.length; i++){
      var fileName = downloadArr[i].mediaurl.split('/')[4];
      new FileDownloader(downloadArr[i].mediaurl,  appDataPath+fileName, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
    }
  };

  var _onFileDownloadError = function(error){
    console.log("Download Error ",error);
  }

  var _onFileDownloadProgress = function(amountDownloaded, totalAmount){
    var updateCopy = amountDownloaded+"mb / "+totalAmount+"mb";
    var percentageDownLoaded = (amountDownloaded / totalAmount) * 100;

    console.log(updateCopy + "  "+ percentageDownLoaded+"%");

  }

  var _onFileDownloaded = function(downloadedFile, error){
    console.log(error);
    if((error && error.message != 'paused') ){

    }else if(error && error.message == 'paused'){
      return;
    }
    else{

      if(!currentJsonUrlObj){
        currentJsonUrlObj = {};
        currentJsonUrlObj.urls = [];
      }


      currentJsonUrlObj.urls.push( {"mediaurl":downloadedFile.remoteUrl} );

      _writeJsonToDisk(currentJsonUrlObj);

      console.log(downloadedFile);

    }
  }


  var _compareJSON = function(localIssues, remoteIssues, callback){

		var largerArray;
		var smallerArray;

		if (localIssues.length > remoteIssues.length){
			largerArray = localIssues;
			smallerArray = remoteIssues;
		}else if(remoteIssues.length > localIssues.length){
			largerArray = remoteIssues;
			smallerArray = localIssues;
		}else{
			largerArray = localIssues;
			smallerArray = remoteIssues;
		}

    var deleteIssuesArr = localIssues.slice(0);
    var addIssuesArr = remoteIssues.slice(0);



		for(var i=0; i< largerArray.length; i++){
			for(var j=0; j < smallerArray.length; j++){

				var localIssue = largerArray[i];
				var remoteIssue = smallerArray[j];

				if(localIssue.mediaurl === remoteIssue.mediaurl){
          _deleteFromArray(deleteIssuesArr,localIssue.mediaurl);
          _deleteFromArray(addIssuesArr,localIssue.mediaurl);
					break;
				}
			}
		}

    console.log("deleteIssuesArr = ",deleteIssuesArr);
    console.log("addIssuesArr = ",addIssuesArr);

    callback(addIssuesArr, deleteIssuesArr);
	};

  var _deleteFromArray = function(arr, path){
    for(var i=0; i< arr.length; i++){
      if(arr[i].mediaurl === path){
        arr.splice(i, 1);
      }
    }
  };

  var destroy = function(){
    // Remove event listeners and null out objects here
  };

  return {
    viewContentPath:viewContentPath,
    viewControllerName:viewControllerName,
    create:create,
    destroy:destroy
  };
};

var ViewController = ViewController || function(){

  var viewContentPath = './app-data/<path>.html';
  var viewControllerName = "ViewController";
  var previousViewControllerName;

  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;  

  };

  var destroy = function(){
    // Remove event listeners and null out objects here
  };

  return {
    viewContentPath:viewContentPath,
    viewControllerName:viewControllerName,
    create:create,
    destroy:destroy
  };
};

var Dialog = Dialog || function(copy, options, callback, pauseCallback){

  var confirmCopy = (options && options.confirmCopy)? options.confirmCopy : "OK";
  var showConfirm  = (options && options.showConfirm != undefined)? options.showConfirm : true;
  var cancelCopy  = (options && options.cancelCopy)? options.cancelCopy : "Cancel";
  var showCancel  = (options && options.showCancel != undefined)? options.showCancel : false;
  var progressCopy  = (options && options.progressCopy)? options.progressCopy : "0%";
  var showProgress  = (options && options.showProgress != undefined)? options.showProgress : false;



  var dialog = document.createElement('div');
  dialog.setAttribute('class', 'dialog');

  var dialogInner = document.createElement('div');
  dialogInner.setAttribute('class', 'dialogInner');

  var dialogCopy = document.createElement('p');
  dialogCopy.innerHTML = copy;

  var buttonsBar = document.createElement('div');
  buttonsBar.setAttribute('class', 'buttonsBar');

  var cancelButton = document.createElement('button');
  cancelButton.addEventListener('click', onButtonClicked, false);
  cancelButton.innerHTML = cancelCopy;
  cancelButton.id = "cancel";
  buttonsBar.appendChild(cancelButton);
  if (showCancel) cancelButton.classList.add('isVisible');

  var confirmButton = document.createElement('button');
  confirmButton.id = "confirm";
  confirmButton.innerHTML = confirmCopy;
  confirmButton.addEventListener('click', onButtonClicked, false);
  buttonsBar.appendChild(confirmButton);
  if (showConfirm) confirmButton.classList.add('isVisible');

  var progressArea = document.createElement('div');
  progressArea.setAttribute('class', 'progressArea');
  var progressCopyDiv = document.createElement('div');
  progressCopyDiv.setAttribute('class', 'dialogProgressCopy');
  progressCopyDiv.innerHTML = progressCopy;
  var progressBar = document.createElement('progress');
  progressBar.setAttribute('class', 'dialogProgress');
  progressBar.setAttribute('max', '100');
  progressBar.setAttribute('value', '0');

  var progressResumePauseButton = document.createElement('button');
  progressResumePauseButton.setAttribute('class', 'progressResumePauseButton');
  progressResumePauseButton.innerHTML = "Pause";
  progressResumePauseButton.addEventListener('click', onResumePauseClicked, false);

  progressArea.appendChild(progressBar);
  progressArea.appendChild(progressCopyDiv);
  progressArea.appendChild(progressResumePauseButton);

  if(showProgress) progressArea.classList.add('isVisible');

  dialogInner.appendChild(dialogCopy);
  dialogInner.appendChild(progressArea);
  dialogInner.appendChild(buttonsBar);
  dialog.appendChild(dialogInner);

  document.body.appendChild(dialog);


  function onButtonClicked(e){
    if(e.target.id === "confirm"){
      callback(true);
    }else if(e.target.id === "cancel"){
      callback(false);
    }

  }

  function onResumePauseClicked(e){
    if (e.target.innerHTML === "Pause"){
      e.target.innerHTML = "Resume";
      pauseCallback(true);
    }else{
      e.target.innerHTML = "Pause";
      pauseCallback(false);
    }
  }

  function onProgressChange(newValue){
    if(newValue === "indeterminate"){
      progressBar.removeAttribute('value');
    }else{
      if(!progressBar.value) progressBar.setAttribute('value', newValue);
      if(!isNaN(newValue))progressBar.value = newValue;
    }
  }

  function onProgressMessageChange(newCopy){
    progressCopyDiv.innerHTML = newCopy;
  }

  function onMessageChange(newCopy){
    dialogCopy.innerHTML = newCopy;
  }
  function onToggleElement(elem){
    if(elem.classList.contains('isVisible')){
      elem.classList.remove('isVisible');
    }else{
      elem.classList.add('isVisible');
    }
  }

  function onHide(){
    document.body.removeChild(dialog);
  }

  return{
    updateProgress: onProgressChange,
    updateProgressMessage: onProgressMessageChange,
    updateMessage: onMessageChange,
    toggleResumePauseButton: function(){onToggleElement(progressResumePauseButton)},
    toggleConfirmButton: function(){onToggleElement(confirmButton)},
    toggleCancelButton: function(){onToggleElement(cancelButton)},
    toggleProgress: function(){onToggleElement(progressArea);onToggleElement(progressResumePauseButton);},
    updateConfirmCopy: function(newCopy){confirmButton.innerHTML = newCopy;},
    updateCancelCopy: function(newCopy){cancelButton.innerHTML = newCopy;},
    hide:onHide
  }


};
