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
