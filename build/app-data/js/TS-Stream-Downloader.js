var App = App || (function(){

  var isOnline = require('is-online');
  var fs = require('fs');
  var crypto = require('crypto');
  var gui = require('nw.gui');
  var algorithm = 'aes-256-ctr';

  //var serverUrl = "http://localhost:8888/DLNA-SERVER/endpoint.html";

  var serverUrl = "http://192.168.1.37/";
  var downloadFolder = "/Users/chrisnewton/Movies/";
  var mediaFolder = "";

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
    downloadFolder:downloadFolder,
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

var FileDownloader = FileDownloader || function(urlObj, targetFilePath, downloadingCallBack, onCompleteCallback, onErrorCallback){

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
  var fileNotFound = false;
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

  console.log("url = "+urlObj.mediaurl);


  function makeFileRequest(){
    //theDownloadedFile.urlObj = urlObj;
    urlObj.targetPath = targetFilePath;
    var theUrl = urlObj.mediaurl;
  //  var theUrl = "http://192.168.1.69:9000/web/media/122.TS";
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

        if(data.statusMessage == "Not Found"){
          var error = {'message':'Not Found'};
          onErrorCallback(error, urlObj);
          fileNotFound = true;
          fs.unlink(targetFilePath);
          req.abort();

          return;
        }

        var contentLengthHeader = data.headers['content-length'];
        var contentRangeHeader = data.headers['content-range'];

        if(!contentLengthHeader && contentRangeHeader){
          len = parseInt( (data.headers['content-range']).split('/')[1], 10);
        }
        else if(contentLengthHeader){
          len = parseInt(data.headers['content-length'], 10);
        }

        //len = parseInt(data.headers['content-length'], 10);

        //len = parseInt( (data.headers['content-range']).split('/')[1], 10);
        console.log(len);
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

          downloadingCallBack(Math.floor(totalAmountDownloaded), Math.floor(totalAmount), urlObj.title);
        }else{
          dppErrorBody += chunk;
        }
    });


    req.on('end', function()
    {

        var error = null;
        var message = "File downloaded successfully";
        if(nothingToDownload){
          console.log("FileDownloader: File already Downloaded");
          message = "File already Downloaded";
        }else if(fileNotFound){
          return;
        }
        else if(userInitiatedCancel){
          error = {'message':'paused'};
        }else if(dppError){
          error = {'message':dppErrorBody};
          console.log(dppErrorBody);
        }
        onCompleteCallback(urlObj, message, error);
    });

    req.on("error", function(e){
        console.log(e);
        onErrorCallback(e, urlObj);
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

var UpnpSearch = UpnpSearch || (function(){
/*
  var Ssdp = require('upnp-ssdp');
  var client = Ssdp();
  client.on('up', function (address) {
      console.log('server found', address);
  });
  client.on('down', function (address) {
      console.log('server ' + address + ' not responding anymore');
  });
  client.on('error', function (err) {
      console.log('error initiating SSDP search', err);
  });
  client.search('device:server');*/

})();

var VideoConverter = VideoConverter || function(sourceVideoPath, targetFilePath, videoOptions, convertingCallBack, onCompleteCallback, onErrorCallback){

  var hbjs = require("handbrake-js");

  //hbjs.spawn({ input: sourceVideoPath, output: targetFilePath, preset:"Normal", rate:25}) // Good for HD TS Files
  hbjs.spawn({ input: sourceVideoPath, output: targetFilePath, preset:"Normal", width:1024, rate:25}) // Good for SD TS Files  
    .on("error", function(err){
      // invalid user input, no video found etc
      onErrorCallback(err);
    })
    .on("progress", function(progress){
      console.log("Percent complete: %s, ETA: %s",progress.percentComplete,progress.eta);
      convertingCallBack(progress);
    })
    .on("end", function(){

    })
    .on("complete", function(){
      onCompleteCallback();
    });

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
  //var indexPath = "browse/index.jim";

  var indexPath = "/browse/index.jim?dir=/media/My%20Video/aaa_server";

  var currentJsonUrlObj;
  var mediaList;
  var totalMediaFilesToDownload = 0;
  var noOfMediaFilesDownloaded = 0;
  var filesToDownloadArray;
  var totalNoOfFilesToTranscode = 0;
  var noOfFilesTranscoded = 0;

  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;

    mediaList = document.querySelector('#mediaList');

    var ipAddressInput = document.querySelector('#ipAddress');
    var tsFolderInput = document.querySelector('#tsFolderLocation');
    var mp4FolderInput = document.querySelector('#mp4FolderLocation');
    var startButton = document.querySelector('#startButton');

    ipAddressInput.value = localStorage.getItem('ipaddress');
    tsFolderInput.value = localStorage.getItem('tsFolderPath');
    mp4FolderInput.value = localStorage.getItem('mp4FolderPath');


    startButton.addEventListener('click', function(){
      localStorage.setItem('ipaddress', ipAddressInput.value);
      localStorage.setItem('tsFolderPath', tsFolderInput.value);
      localStorage.setItem('mp4FolderPath', mp4FolderInput.value);

      App.serverUrl = ipAddressInput.value;
      App.downloadFolder = tsFolderInput.value;
      console.log('BOOM');
      _getCurrentUrls();

      //_convertVideo(App.downloadFolder+'01.ts', App.downloadFolder+'01.mp4');

    }, false);
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
                  mediaList.innerHTML = "No Changes on Server";
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
                    totalMediaFilesToDownload = downloadArray.length;
                    filesToDownloadArray = downloadArray;
                    _downloadMediaFiles();
                  }
                }
              });

            }else{
              // First run so download everything
              totalMediaFilesToDownload = remoteJsonUrlObj.urls.length;
              filesToDownloadArray = remoteJsonUrlObj.urls;
              _downloadMediaFiles();


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
    console.log(App.serverUrl+indexPath);
    request(App.serverUrl+indexPath, function (error, response, data) {

      if (!error && response.statusCode == 200) {
        console.log(response.body);

        var parser = new DOMParser();
        var viewContentHTML = parser.parseFromString(response.body, "text/html");
        var viewContent = viewContentHTML.body;
    //  console.log(viewContent);
        var dlnaElems = viewContent.querySelectorAll('fieldset.cleft div.va.bf');
        //console.log(dlnaElems);

        var dlnaElemsJsonObj = {};
        dlnaElemsJsonObj.urls = [];

      //  console.log(dlnaElems[]);

        var totalNoOfLinks = dlnaElems.length;
        var noOfLinksReceived = 0;

        for(var i=0; i< dlnaElems.length; i++){

          var mediaLink = dlnaElems[i].querySelector('a.bf');
          //console.log(mediaLink.getAttribute('file'));

          //var desc = mediaLink.title;
          var file = mediaLink.getAttribute('file');
          //var title = decodeURI(mediaUrl.split('/')[3]);
          var type = mediaLink.getAttribute('type');

          //var dlnaUrl = "http://192.168.1.69/browse/download.jim?file="+file+"&base=192.168.1.69";

          var fileUrl = App.serverUrl+'browse/file.jim?file=' + file+ '&type=' + type;
          console.log( 'fileUrl = '+fileUrl);

          request(fileUrl, function (error, response, data) {
            if (!error && response.statusCode == 200) {
              noOfLinksReceived++;
              var fileInfoHTML = parser.parseFromString(response.body, "text/html");
              var fileInfoHTMLBody = fileInfoHTML.body;

              var dlnaUrl = fileInfoHTMLBody.querySelector('a').href;
              var title = decodeURI(((fileInfoHTMLBody.querySelector('.bmp.va')).getAttribute('src')).split('/')[4]);
              //console.log( 'Title = '+title);
              //console.log(dlnaUrl);

              var desc = "";
              var definition = "";
              var genre = "Film";

              var tableHeaders = fileInfoHTMLBody.querySelectorAll('th');
              for(var j=0; j< tableHeaders.length; j++){
                var tableTitle = tableHeaders[j].innerHTML;
                if(tableTitle.toLowerCase() == "synopsis"){
                  desc = tableHeaders[j].parentNode.children[1].innerHTML;
                }
                if(tableTitle.toLowerCase() == "flags"){
                  definition = tableHeaders[j].parentNode.children[1].innerHTML.substring(0,2);
                }
              }

              dlnaElemsJsonObj.urls.push( {"mediaurl":dlnaUrl,"title":title,"desc":desc, "definition":definition} );

              if(noOfLinksReceived == totalNoOfLinks){
                callback(null, dlnaElemsJsonObj);
              }
            }
            else if(error){
              totalNoOfLinks--;
            }
          });

        }
        console.log(dlnaElemsJsonObj);


        //console.log("dlnaElemsJsonObj ",dlnaElemsJsonObj);
        //console.log(JSON.stringify(dlnaElemsJsonObj));

      }else if(error){
        console.log(error);
        callback(error, null);
      }

    });
  };







  var _downloadMediaFiles = function(){

    console.log("noOfMediaFilesDownloaded ",noOfMediaFilesDownloaded);
    console.log("totalMediaFilesToDownload ",totalMediaFilesToDownload);

    //var movieToGet;

    for(var i=0; i<filesToDownloadArray.length; i++){
      var mediaElement = document.createElement('li');
      mediaElement.urlObj = filesToDownloadArray[i];

      var fileName = filesToDownloadArray[i].title;

      // if(fileName.indexOf("Drive") != -1){
      //   movieToGet = i;
      // }

      var mediaLabel = document.createElement('p');
      mediaLabel.innerHTML = fileName;
      mediaLabel.setAttribute('class','mediaLabel');
      var progLabel = document.createElement('p');
      progLabel.setAttribute('class','progLabel');
      progLabel.innerHTML = "";
      var mediaProgress = document.createElement('progress');
      mediaProgress.max = "100";
      mediaProgress.value = "0";
      mediaElement.appendChild(mediaLabel);
      mediaElement.appendChild(progLabel);
      mediaElement.appendChild(mediaProgress);
      mediaList.appendChild(mediaElement);
    }

    var fileName = filesToDownloadArray[noOfMediaFilesDownloaded].title;
    _startDownloadOfFile(filesToDownloadArray[noOfMediaFilesDownloaded], App.downloadFolder+fileName, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
    //var fileName = filesToDownloadArray[movieToGet].title;
    //_startDownloadOfFile(filesToDownloadArray[movieToGet], App.downloadFolder+fileName, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
  };

  var _startDownloadOfFile = function(urlObj, targetFilePath, downloadingCallBack, onCompleteCallback, onErrorCallback){
    new FileDownloader(urlObj, targetFilePath, downloadingCallBack, onCompleteCallback, onErrorCallback);

  };

  var _onFileDownloadError = function(error, urlObj){
    console.log("Download Error ",error);
    for(var i=0; i<mediaList.children.length; i++){
      if(mediaList.children[i].urlObj.title === urlObj.title){
        mediaList.children[i].children[1].innerHTML = "File not found on server";
      }
    }
    totalMediaFilesToDownload--;
  }

  var _onFileDownloadProgress = function(amountDownloaded, totalAmount, mediaTitle){
    var updateCopy = amountDownloaded+"mb / "+totalAmount+"mb";
    var percentageDownLoaded = (amountDownloaded / totalAmount) * 100;

    for(var i=0; i<mediaList.children.length; i++){
      if(mediaList.children[i].urlObj.title === mediaTitle){

        mediaList.children[i].children[1].innerHTML = updateCopy + "  "+Math.floor(percentageDownLoaded)+"%";
        mediaList.children[i].children[2].value = percentageDownLoaded;
      }
    }
  }

  var _onFileDownloaded = function(urlObj, message, error){
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
      currentJsonUrlObj.urls.push( {"mediaurl":urlObj.mediaurl,"title":urlObj.title,"desc":urlObj.desc, "localFile":urlObj.targetPath} );
      _writeJsonToDisk(currentJsonUrlObj);
      noOfMediaFilesDownloaded++;

      for(var i=0; i<mediaList.children.length; i++){
        if(mediaList.children[i].urlObj.title === urlObj.title){
          mediaList.children[i].classList.add('dlComplete');
          mediaList.children[i].children[1].innerHTML = message;
          // put tick by download
        }
      }

      //if(noOfMediaFilesDownloaded === totalMediaFilesToDownload){
      if(noOfMediaFilesDownloaded === 1){
        // Start transcoding the files
        totalNoOfFilesToTranscode = currentJsonUrlObj.urls.length;
        _convertVideo(currentJsonUrlObj.urls[noOfFilesTranscoded].localFile, currentJsonUrlObj.urls[noOfFilesTranscoded].localFile+".mp4");

      }else{
        var fileName = filesToDownloadArray[noOfMediaFilesDownloaded].title;
        _startDownloadOfFile(filesToDownloadArray[noOfMediaFilesDownloaded], App.downloadFolder+fileName, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
      }
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


  var _convertVideo = function(srcFile, destFile){
    new VideoConverter(srcFile, destFile, null, _onConvertProgress, _onConvertComplete, _onConvertError);
  };

  var _onConvertError = function(error){
    console.log("error = "+error);
  };
  var _onConvertProgress = function(progress){
    console.log("converting file = "+progress.percentComplete+"  "+progress.eta);

  };
  var _onConvertComplete = function(){
    console.log("conversion Complete");
    noOfFilesTranscoded++;
    if(noOfFilesTranscoded == 1){
    //if(noOfFilesTranscoded == totalNoOfFilesToTranscode){
      // FInished
    }else{
      _convertVideo(currentJsonUrlObj.urls[noOfFilesTranscoded].localFile, currentJsonUrlObj.urls[noOfFilesTranscoded].localFile+".mp4");
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
