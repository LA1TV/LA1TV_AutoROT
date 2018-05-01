var events = require("events")
var spawn = require('child_process').spawn;


var Webhook = require("./webhook")
var webhook = new Webhook()

var website = require("./la1api");

var qualityIds = [2, 3, 4, 5, 6]


var publicNotifier = new events.EventEmitter();


webhook.on("live", function (payload) {

    var url
    website.apiRequest("mediaItems/" + payload.payload.id, function (data) {
        // console.log(data.data.mediaItem)
        url = getMediaUrl(data.data.mediaItem, "stream")
        console.log(url)

        new Recorder(url, payload.payload.id)

    })
})


//webhook.emit("live", {payload:{id: 826}})
//  ----that was my cheaty test


function Recorder(url, id) {

    //get URL
    if(!url){
        console.error("No url stuff!")
        return
    }
    var date = "" + Date.now()
    date = date.slice(5, 10)

    var filename = url.mediaItem.id + "_" + url.mediaItem.name + "_" + date;

    var commandArgs = ["-i", url.url, "-c", "copy", "-bsf:a", "aac_adtstoasc ", "/mnt/volume-lon1-01/autorot/" + filename + ".mp4"]

    //ffmpeg -i http://.../playlist.m3u8 -c copy -bsf:a aac_adtstoasc output.mp4
    console.log("starting ffmpeg, " + commandArgs)
    var ffmpeg = spawn("ffmpeg", commandArgs)

    ffmpeg.on('exit', function () {
        console.log("Exited ")
    });



    console.log("end" + id)
    webhook.once("end" + id, function () {
        console.log("Killing FFMPEG id " + id)
        ffmpeg.kill()
    })


}


function getMediaUrl(mediaItem, type) {
    if (type !== "video" && type !== "stream") {
        throw "Invalid item type.";
    }


    var mediaItemPart = type === "video" ? mediaItem.vod : mediaItem.liveStream;
    if(!mediaItemPart.qualities){
        console.error("looks like there aren't any sources to pick from...")
        return null;
    }

    var availableQualityIds = [];
    for (var j = 0; j < mediaItemPart.qualities.length; j++) {
        availableQualityIds.push(mediaItemPart.qualities[j].id);
    }
    var chosenUrl = null;
    for (var j = 0; j < qualityIds.length && chosenUrl === null; j++) {
        var proposedQualityId = qualityIds[j];
        if (availableQualityIds.indexOf(proposedQualityId) !== -1) {
            // find the url for the mp4 encoded version
            for (var k = 0; k < mediaItemPart.urlData.length && chosenUrl === null; k++) {
                var item = mediaItemPart.urlData[k];
                if (item.quality.id === proposedQualityId) {
                    for (var j = 0; j < item.urls.length; j++) {
                        var urlInfo = item.urls[j];
                        if (type === "video") {
                            if (urlInfo.type === "video/mp4") {
                                chosenUrl = urlInfo.url;
                                break;
                            }
                        } else if (type === "stream") {
                            if (urlInfo.type === "application/x-mpegURL") {
                                chosenUrl = urlInfo.url;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    if (chosenUrl === null) {
        // could not find an applicable url
        return null;
    }

    return {
        mediaItem: mediaItem,
        url: chosenUrl,
        type: type
    };
}