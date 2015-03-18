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
