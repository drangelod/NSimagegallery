const cameraModule = require("nativescript-camera");
const Observable = require("tns-core-modules/data/observable").Observable;
const ObservableArray = require("data/observable-array").ObservableArray;
const fromObject = require("tns-core-modules/data/observable").fromObject;
const frameModule = require("ui/frame");

const applicationSettings = require("application-settings");
const fsModule = require("tns-core-modules/file-system");
const imageSourceModule = require("tns-core-modules/image-source");
const utilsModule = require("utils/utils");
var initFlag = 0;

var currentPage;
var cameraModel = new PhotoGalleryComponent();

function PhotoGalleryComponent() {
  var PhotoGalleryObj = new Observable();
  PhotoGalleryObj.arrayPictures = new ObservableArray();
  PhotoGalleryObj.takePicture = function() {
    cameraModule
      .takePicture({
        width: 300, //These are in device independent pixels
        height: 300, //Only one may be respected depending on os/device if
        keepAspectRatio: true, //    keepAspectRatio is enabled.
        saveToGallery: false //Don't save a copy in local gallery, ignored by some Android devices
      })
      .then(picture => {
        imageSourceModule.fromAsset(picture).then(
          savedImage => {
            let filename = "image" + "-" + new Date().getTime() + ".png";
            let folder = fsModule.knownFolders.documents();
            let path = fsModule.path.join(folder.path, filename);
            savedImage.saveToFile(path, "png");
            var loadedImage = imageSourceModule.fromFile(path);
            loadedImage.filename = filename;
            loadedImage.note = "";
            this.arrayPictures.unshift(loadedImage);
            this.storeData();
            if (currentPage.android) {
              let tmpfolder = fsModule.Folder.fromPath(
                utilsModule.ad
                  .getApplicationContext()
                  .getExternalFilesDir(null)
                  .getAbsolutePath()
              );
              tmpfolder.getEntities().then(
                function(entities) {
                  entities.forEach(function(entity) {
                    if (entity.name.substr(0, 5) == "NSIMG") {
                      var tmpfile = tmpfolder.getFile(entity.name);
                      tmpfile.remove();
                    }
                  });
                },
                function(error) {
                  console.log(error.message);
                }
              );
              utilsModule.GC(); //trigger garbage collection for android
            }             
          },
          err => {
            console.log("Failed to load from asset");                    
          }
        );
      });
  };

  PhotoGalleryObj.deletePicture = function(args) {
    const documents = fsModule.knownFolders.documents();
    let parentobj = args.object.parent.parent; //StackLayout
    let imgobj = parentobj.getChildAt(0); //image is the first child
    const filename = imgobj.src.filename;
    var file = documents.getFile(filename);
    file.remove();
    let pictureIndex = this.arrayPictures.indexOf(imgobj.src);
    this.arrayPictures.splice(pictureIndex, 1);
    this.storeData();
  };
  PhotoGalleryObj.storeData = function() {
    let localArr = [];
    for (var i = 0; i < this.arrayPictures.length; i++) {
      let entry = this.arrayPictures.getItem(i);
      localArr.push({ note: entry.note, filename: entry.filename });      
    }
    applicationSettings.setString("localdata", JSON.stringify(localArr));
    if (this.arrayPictures.length) {//hack to trigger refresh of bound image array
      var loadedImage = this.arrayPictures.shift();
      this.arrayPictures.unshift(loadedImage);
    }
  };
  PhotoGalleryObj.loadData = function() {
    let strData = applicationSettings.getString("localdata");
    if (strData && strData.length) {
      let localArr = JSON.parse(strData);
      for (var i = localArr.length - 1; i > -1; i--) {
        let entry = localArr[i];
        const folder = fsModule.knownFolders.documents();
        const path = fsModule.path.join(folder.path, entry.filename);
        var loadedImage = imageSourceModule.fromFile(path);
        loadedImage.filename = entry.filename;
        loadedImage.note = entry.note;
        this.arrayPictures.unshift(loadedImage);
      }
    }
  };
  return PhotoGalleryObj;
}

exports.tapPicture = function(eventData) {
  var imgObj = eventData.object.getChildAt(0);
  navContextObj = {
    srcPicture: imgObj.src,
    cameraModel: cameraModel
  };
  var topmost = frameModule.topmost();
  topmost.navigate({
    moduleName: "full-image",
    context: navContextObj,
    animated: true,
    transition: {
      name: "slideLeft",
      duration: 80,
      curve: "linear"
    }
  });
};

function onLoaded(args) {
  args.object.page.bindingContext = fromObject(cameraModel);
  if (initFlag == 0) {
    currentPage = args.object;
    var buttonCamera = currentPage.getViewById("buttonCamera");
    if (cameraModule.isAvailable()) {
      //checks to make sure device has a camera
    } else {
      //ignore this on simulators for now
    }
    cameraModule.requestPermissions().then(
      //request permissions for camera
      success => {
        //have permissions
      },
      failure => {
        //no permissions for camera,disable picture button
        buttonCamera.isEnabled = false;
      }
    );
    cameraModel.loadData();
    initFlag = 1;
  } 
}
exports.onLoaded = onLoaded;
