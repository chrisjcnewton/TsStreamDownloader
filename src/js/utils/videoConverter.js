var VideoConverter = VideoConverter || function(sourceVideoPath, targetFilePath, videoOptions, convertingCallBack, onCompleteCallback, onErrorCallback){

  var hbjs = require("handbrake-js");

  hbjs.spawn({ input: sourceVideoPath, output: targetFilePath, preset:"Normal"})
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
