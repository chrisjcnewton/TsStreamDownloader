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
