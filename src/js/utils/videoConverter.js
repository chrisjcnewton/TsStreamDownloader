var VideoConverter = VideoConverter || function(sourceVideoPath, targetFilePath, definition, convertingCallBack, onCompleteCallback, onErrorCallback){

  var hbjs = require("handbrake-js");

  var videoOptions = {input: sourceVideoPath, output: targetFilePath, preset:"Normal", rate:25};
console.log("definition = "+definition);
  if(definition == "SD"){
    videoOptions.width = 1024;
  }

  hbjs.spawn(videoOptions)
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
