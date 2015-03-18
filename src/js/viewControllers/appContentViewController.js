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
