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
