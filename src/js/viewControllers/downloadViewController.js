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
  var mediaList;


  var create = function(extras){
    previousViewControllerName = extras? extras.previousViewControllerName : null;

    mediaList = document.querySelector('#mediaList');
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

      var mediaElement = document.createElement('li');
      mediaElement.mediaurl = downloadArr[i].mediaurl;

      var mediaLabel = document.createElement('p');
      mediaLabel.innerHTML = fileName;
      var mediaProgress = document.createElement('progress');
      mediaProgress.max = "100";
      mediaProgress.value = "0";
      mediaElement.appendChild(mediaLabel);
      mediaElement.appendChild(mediaProgress);
      mediaList.appendChild(mediaElement);

      new FileDownloader(downloadArr[i].mediaurl,  appDataPath+fileName, _onFileDownloadProgress, _onFileDownloaded, _onFileDownloadError);
    }
  };

  var _onFileDownloadError = function(error){
    console.log("Download Error ",error);
  }

  var _onFileDownloadProgress = function(amountDownloaded, totalAmount, remoteUrl){
    var updateCopy = amountDownloaded+"mb / "+totalAmount+"mb";
    var percentageDownLoaded = (amountDownloaded / totalAmount) * 100;

    for(var i=0; i<mediaList.children.length; i++){
      if(mediaList.children[i].mediaurl === remoteUrl){
        mediaList.children[i].children[1].value = percentageDownLoaded;
      }
    }

    //console.log(updateCopy + "  "+ percentageDownLoaded+"%");

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
