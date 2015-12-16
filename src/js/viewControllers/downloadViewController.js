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

  var indexPath = "/browse/index.jim?dir=/media/My%20Video/aaa_server";
  //var indexPath = "/Workspace/TS-Server/aaa_server_page.html";

  var currentJsonUrlObj;
  var mediaList;
  var totalMediaFilesToDownload = 0;
  var noOfMediaFilesDownloaded = 0;
  var filesToDownloadArray;
  var totalNoOfFilesToTranscode = 0;
  var noOfFilesTranscoded = 0;
  var filesToTranscodeObj;
  var startButton;
  var startScanTimeout;
  var scanInterval = 3000;
  var scanStarted = false;

  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;

    mediaList = document.querySelector('#mediaList');

    var ipAddressInput = document.querySelector('#ipAddress');
    var tsFolderInput = document.querySelector('#tsFolderLocation');
    var mp4FolderInput = document.querySelector('#mp4FolderLocation');
    var stopButton = document.querySelector('#stopButton');
    startButton = document.querySelector('#startButton');

    ipAddressInput.value = localStorage.getItem('ipaddress');
    tsFolderInput.value = localStorage.getItem('tsFolderPath');
    mp4FolderInput.value = localStorage.getItem('mp4FolderPath');

    stopButton.addEventListener('click',function(){
      clearTimeout(startScanTimeout);
      startButton.disabled = false;
    },false);


    startButton.addEventListener('click', function(){

      startButton.disabled = true;
      localStorage.setItem('ipaddress', ipAddressInput.value);
      localStorage.setItem('tsFolderPath', tsFolderInput.value);
      localStorage.setItem('mp4FolderPath', mp4FolderInput.value);

      App.serverUrl = ipAddressInput.value;
      App.downloadFolder = tsFolderInput.value;
      App.mediaFolder = mp4FolderInput.value;


      _startScanning();

      //_convertVideo(App.downloadFolder+'01.ts', App.downloadFolder+'01.mp4');

    }, false);
  };


  var _startScanning = function(){
    
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
                  if(startButton.disabled)startScanTimeout = setTimeout(_startScanning, scanInterval); // Wait for scanInterval then scan again
                }
                else{
                  if(deleteArray.length > 0){
                    console.log("deleteArray = ",deleteArray);
                    // Delete some files
                    for(var i=0; i< deleteArray.length; i++){
                      var fileName = deleteArray[i].mediaurl.split('/')[6];
                      try{
                        //fs.unlinkSync(appDataPath + fileName);
                        fs.unlinkSync( deleteArray[i].localFile );
                        _deleteFromArray(currentJsonUrlObj.urls, deleteArray[i].mediaurl);
                      }catch(e){
                        _deleteFromArray(currentJsonUrlObj.urls, deleteArray[i].mediaurl);
                        console.log("couldn't find file "+appDataPath + fileName+" but deleted it from json anyway");
                      }
                    }
                    _writeJsonToDisk(currentJsonUrlObj);
                    if(startButton.disabled)startScanTimeout = setTimeout(_startScanning, scanInterval); // Wait for scanInterval then scan again
                  }
                  if(downloadArray.length > 0){
                    totalMediaFilesToDownload = downloadArray.length;
                    filesToDownloadArray = downloadArray;
                    noOfMediaFilesDownloaded = 0;
                    noOfFilesTranscoded = 0;
                    filesToTranscodeObj = null;
                    _downloadMediaFiles();
                  }
                }
              });

            }else{
              // First run so download everything
              totalMediaFilesToDownload = remoteJsonUrlObj.urls.length;
              filesToDownloadArray = remoteJsonUrlObj.urls;
              noOfMediaFilesDownloaded = 0;
              noOfFilesTranscoded = 0;
              filesToTranscodeObj = null;
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

    // ******* For Testing
    request("http://localhost:8888/Workspace/TS-Server/humax.json", function (error, response, data) {
      var jsonObj = JSON.parse(response.body);
      callback(null, jsonObj);
    });

    return;
    // ***** end For Testing

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

      if(!filesToTranscodeObj){
        filesToTranscodeObj = {};
        filesToTranscodeObj.urls = [];
      }

      //if(message !== "File already Downloaded"){
        currentJsonUrlObj.urls.push( {"mediaurl":urlObj.mediaurl,"title":urlObj.title,"desc":urlObj.desc, "localFile":urlObj.targetPath, "definition":urlObj.definition} );
        filesToTranscodeObj.urls.push( {"mediaurl":urlObj.mediaurl,"title":urlObj.title,"desc":urlObj.desc, "localFile":urlObj.targetPath, "definition":urlObj.definition} );
      //}
      _writeJsonToDisk(currentJsonUrlObj);
      noOfMediaFilesDownloaded++;

      for(var i=0; i<mediaList.children.length; i++){
        if(mediaList.children[i].urlObj.title === urlObj.title){
          mediaList.children[i].classList.add('dlComplete');
          mediaList.children[i].children[1].innerHTML = message;
          // put tick by download
        }
      }

      //if(noOfMediaFilesDownloaded === 1){
      if(noOfMediaFilesDownloaded === totalMediaFilesToDownload){
        // Start transcoding the files
        totalNoOfFilesToTranscode = filesToTranscodeObj.urls.length;

        //console.log("currentJsonUrlObj.urls[noOfFilesTranscoded].definition = "+currentJsonUrlObj.urls[noOfFilesTranscoded].definition);

        _convertVideo(filesToTranscodeObj.urls[noOfFilesTranscoded].localFile, App.mediaFolder+filesToTranscodeObj.urls[noOfFilesTranscoded].title+".mp4", filesToTranscodeObj.urls[noOfFilesTranscoded].definition);

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
          console.log("match = ",localIssue.mediaurl);

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


  var _convertVideo = function(srcFile, destFile, definition){
    new VideoConverter(srcFile, destFile, definition, _onConvertProgress, _onConvertComplete, _onConvertError);
  };

  var _onConvertError = function(error){
    console.log("error = "+error);
  };
  var _onConvertProgress = function(progress){
    var mediaTitle = filesToTranscodeObj.urls[noOfFilesTranscoded].title;
    for(var i=0; i<mediaList.children.length; i++){
      if(mediaList.children[i].urlObj.title === mediaTitle){
        mediaList.children[i].children[1].innerHTML = "Converting to mp4:  "+Math.floor(progress.percentComplete)+"%, ETA: "+progress.eta;
        mediaList.children[i].children[2].value = progress.percentComplete;
      }
    }
    //console.log("converting file = "+progress.percentComplete+"  "+progress.eta);

  };
  var _onConvertComplete = function(){
    console.log("conversion Complete");
    var mediaTitle = filesToTranscodeObj.urls[noOfFilesTranscoded].title;
    for(var i=0; i<mediaList.children.length; i++){
      if(mediaList.children[i].urlObj.title === mediaTitle){
        mediaList.children[i].classList.add('convComplete');
        mediaList.children[i].children[1].innerHTML = "File Downloaded & Converted";
      }
    }
    noOfFilesTranscoded++;
    if(noOfFilesTranscoded == totalNoOfFilesToTranscode){
      // FInished
      console.log("----~ ALL conversions Complete ~-----");
      if(startButton.disabled)startScanTimeout = setTimeout(_startScanning, scanInterval); // Wait for scanInterval then scan again
    }else{
      _convertVideo(filesToTranscodeObj.urls[noOfFilesTranscoded].localFile, App.mediaFolder+filesToTranscodeObj.urls[noOfFilesTranscoded].title+".mp4", filesToTranscodeObj.urls[noOfFilesTranscoded].definition);
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
