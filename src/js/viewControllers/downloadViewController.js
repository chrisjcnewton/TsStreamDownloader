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
  var indexPath = "browse/index.jim";

  var currentJsonUrlObj;
  var mediaList;
  var totalMediaFilesToDownload = 0;
  var noOfMediaFilesDownloaded = 0;
  var filesToDownloadArray;

  var testData = {
                  urls:[
                    {
                      title:"01.zip",
                      desc:"01 desc",
                      mediaurl:"http://localhost:8888/DLNA-SERVER/01.zip"
                    },
                    {
                      title:"02.zip",
                      desc:"02 desc",
                      mediaurl:"http://localhost:8888/DLNA-SERVER/02.zip"
                    },
                    {
                      title:"03.zip",
                      desc:"03 desc",
                      mediaurl:"http://localhost:8888/DLNA-SERVER/03.zip"
                    },
                    {
                      title:"04.zip",
                      desc:"04 desc",
                      mediaurl:"http://localhost:8888/DLNA-SERVER/04.zip"
                    },
                    {
                      title:"05.zip",
                      desc:"05 desc",
                      mediaurl:"http://localhost:8888/DLNA-SERVER/05.zip"
                    }
                  ]
                };


  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;

    mediaList = document.querySelector('#mediaList');

    _getCurrentUrls();

    //_convertVideo();
/*
    totalMediaFilesToDownload = testData.urls.length;
    filesToDownloadArray = testData.urls;
    _downloadMediaFiles();
*/
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
    request(App.serverUrl+indexPath, function (error, response, data) {

      if (!error && response.statusCode == 200) {
        //console.log(response.body);

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

          request(fileUrl, function (error, response, data) {
            if (!error && response.statusCode == 200) {
              noOfLinksReceived++;
              var fileInfoHTML = parser.parseFromString(response.body, "text/html");
              var fileInfoHTMLBody = fileInfoHTML.body;

              var dlnaUrl = fileInfoHTMLBody.querySelector('a').href;
              var title = decodeURI(((fileInfoHTMLBody.querySelector('.bmp.va')).getAttribute('src')).split('/')[3]);
              //console.log( title);
              //console.log(dlnaUrl);
              var desc = "";
            //  console.log(fileInfoHTML);

              // TODO: need to go into dom for this info and get dlnaurl, title and desc

              dlnaElemsJsonObj.urls.push( {"mediaurl":dlnaUrl,"title":title,"desc":desc} );

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
        callback(error, null);
      }

    });
  };







  var _downloadMediaFiles = function(){

    console.log("noOfMediaFilesDownloaded ",noOfMediaFilesDownloaded);
    console.log("totalMediaFilesToDownload ",totalMediaFilesToDownload);

    for(var i=0; i<filesToDownloadArray.length; i++){
      var mediaElement = document.createElement('li');
      mediaElement.urlObj = filesToDownloadArray[i];

      var fileName = filesToDownloadArray[i].title;

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
      currentJsonUrlObj.urls.push( {"mediaurl":urlObj.mediaurl,"title":urlObj.title,"desc":urlObj.desc} );
      _writeJsonToDisk(currentJsonUrlObj);
      noOfMediaFilesDownloaded++;

      for(var i=0; i<mediaList.children.length; i++){
        if(mediaList.children[i].urlObj.title === urlObj.title){
          mediaList.children[i].classList.add('dlComplete');
          mediaList.children[i].children[1].innerHTML = message;
          // put tick by download
        }
      }

      if(noOfMediaFilesDownloaded === totalMediaFilesToDownload){
        // Start transcoding the files
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


  var _convertVideo = function(){
    new VideoConverter(appDataPath+"uncle_test.ts", appDataPath+"uncle_test_normal_32.mp4", null, _onConvertProgress, _onConvertComplete, _onConvertError);
  };

  var _onConvertError = function(error){
    console.log("error = "+error);
  };
  var _onConvertProgress = function(progress){
    console.log("converting file = "+progress.percentComplete+"  "+progress.eta);

  };
  var _onConvertComplete = function(){
    console.log("conversion Complete");
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
