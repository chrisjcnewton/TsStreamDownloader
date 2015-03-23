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
