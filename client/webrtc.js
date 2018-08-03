var localVideo;
var localStream;
var remoteStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;
/////////////////////////////////////////////////////////////////////////////
var audioInputSelect ;
var audioOutputSelect;
var videoSelect ;
var selectors ;
var latency;
var lostPacket;

var localVideoDiv;

const HTTPS_PORT = 8443;
function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    var values = selectors.map(function(select) {
        return select.value;
    });
    selectors.forEach(function(select) {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    var x;
    for (var i = 0; i !== deviceInfos.length; ++i) {
        var deviceInfo = deviceInfos[i];
        var option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label ||
                'microphone ' + (audioInputSelect.length + 1);
            audioInputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'audiooutput') {
            option.text = deviceInfo.label || 'speaker ' +
                (audioOutputSelect.length + 1);
            audioOutputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {

            option.text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
            videoSelect.appendChild(option);
            if(deviceInfo.label.indexOf("RGB")!==-1){
                x = i;
            }
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
        console.log(option.text)
    }
    console.log("################"+x);

    //document.getElementById('videoSource').value="Intel(R) RealSense(TM) 430 with RGB Module RGB (8086:0b07)";
    selectors.forEach(function(select, selectorIndex) {
        if (Array.prototype.slice.call(select.childNodes).some(function(n) {
            return n.value === values[selectorIndex];
        })) {
            select.value = values[selectorIndex];
        }
    });
}
function handleError(error) {
    console.log('navigator.getUserMedia error: ', error);
}

function gotStream(stream) {
    window.stream = stream; // make stream available to console
    // videoElement.srcObject = stream;
    localVideo.srcObject = stream;
    // Refresh button list in case labels have become available
    return navigator.mediaDevices.enumerateDevices();
}
function changeDevice() {
    if (window.stream) {
        window.stream.getTracks().forEach(function(track) {
            track.stop();
        });
    }
    var audioSource = audioInputSelect.value;
    var videoSource = videoSelect.value;
    // console.log("!!!!!!"+videoSource);
    // videoSource = "8923c55a285c948434c51458bf5b578a854534e0445fe312f35797a852eee0ea";
    var constraints = {
        audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
        video: {deviceId: videoSource ? {exact: videoSource} : undefined}
        //   video: "8923c55a285c948434c51458bf5b578a854534e0445fe312f35797a852eee0ea"
        // video: "997cc34ab751953fabe0de90b823b0b03ae73a829a43430db906e70c776e0539"
    };
    navigator.mediaDevices.getUserMedia(constraints).
    then(gotStream).then(gotDevices).catch(handleError);
}
// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
    if (typeof element.sinkId !== 'undefined') {
        element.setSinkId(sinkId)
            .then(function() {
                console.log('Success, audio output device attached: ' + sinkId);
            })
            .catch(function(error) {
                var errorMessage = error;
                if (error.name === 'SecurityError') {
                    errorMessage = 'You need to use HTTPS for selecting audio output ' +
                        'device: ' + error;
                }
                console.error(errorMessage);
                // Jump back to first output device in the list as it's the default.
                audioOutputSelect.selectedIndex = 0;
            });
    } else {
        console.warn('Browser does not support output device selection.');
    }
}
function changeAudioDestination() {
    var audioDestination = audioOutputSelect.value;
    attachSinkId(videoElement, audioDestination);
}
// audioInputSelect.onchange = changeDevice();
// audioOutputSelect.onchange = changeAudioDestination;
// videoSelect.onchange = changeDevice();
/////////////////////////////////////////////////////////////////////////////

var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:stun.stunprotocol.org:3478'},
        {'urls': 'stun:stun.l.google.com:19302'},
    ]
};
function pageReady() {
    window.onload = function() {

        // Normalize the various vendor prefixed versions of getUserMedia.
        navigator.getUserMedia = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia);


    };

    uuid = createUUID();
    configureDiv = document.getElementById("configureDiv");
    localVideoDiv = document.getElementById("localVideoDiv");
    upButton = document.getElementById("upButton");
    descButton = document.getElementById("descButton");
    latency = document.getElementById('latency');
    lostPacket = document.getElementById('lostPacket');
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
    audioInputSelect = document.querySelector('select#audioSource');
    audioOutputSelect = document.querySelector('select#audioOutput');
    videoSelect = document.querySelector('select#videoSource');
    selectors = [audioInputSelect, audioOutputSelect, videoSelect];
    audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);


    serverConnection = new WebSocket('wss://' + window.location.hostname + ':'+HTTPS_PORT);
    serverConnection.onmessage = gotMessageFromServer;
    // serverConnection.close();
    var constraints = {
        video: true,
        audio: true,
    };
    changeDevice();
}



var checkIsConnecting = false;
function start(isCaller) {
    console.log("peerConnection:::", peerConnection);
    if(typeof peerConnection !== "undefined"){
        console.log("STATE:::", peerConnection.iceConnectionState);
        if(peerConnection.iceConnectionState==="completed"){
            return 0;
        }
        if(peerConnection.iceConnectionState==="new"){
            peerConnection = null;
        }else{
            console.log('peer state:::', peerConnection.iceConnectionState);
        }


    }
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream(localVideo.srcObject);
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // peerConnection.onaddstream = onRemoteStreamAdded;
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////////
    if(isCaller) {
        if(!serverConnection) {
            serverConnection = new WebSocket('wss://' + window.location.hostname + ':' + HTTPS_PORT);
        }
        serverConnection.onmessage = gotMessageFromServer;
        // serverConnection.close();
        peerConnection.createOffer().then(createdDescription).catch(errorHandler);

    }
}
function gotMessageFromServer(message) {
    if(!peerConnection) start(false);
    var signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if(signal.uuid == uuid) return;

    if(signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
            // Only create answers in response to offers
            if(signal.sdp.type == 'offer') {
                peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
            }
        }).catch(errorHandler);
    } else if(signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
}

function gotIceCandidate(event) {
    if(event.candidate != null) {
        serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
    }
}

function createdDescription(description) {
    console.log('got description');

    peerConnection.setLocalDescription(description).then(function() {
        serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
    }).catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log('got remote stream');
    remoteStream = event.streams[0];
    // getStats(peerConnection);
    remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
    console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// var onRemoteStreamAdded = function(event) {
//     // attachMediaStream(remoteVideo, event.stream);
//     remoteStream = event.stream;
// };
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// function getStats(peer) {
//     myGetStats(peer, function (results) {
//         // for (var i = 0; i < results.length; ++i) {
//         //     var res = results[i];
//         //     console.log(res);
//         //
//         // }
//         // console.log(results)
//         try {
//             latency.innerHTML = results[18]["googTargetDelayMs"]+"ms";
//             lostPacket.innerHTML = results[17]["packetsLost"]
//             console.log(results[17]["packetsLost"]);
//             console.log(results[18]["googTargetDelayMs"]);
//         }catch (e) {
//             console.log(e);
//         }
//         peerConnection.oniceconnectionstatechange = function() {
//             if(peerConnection.iceConnectionState == 'disconnected') {
//                 // remoteVideo.srcObject = null
//                 console.log('Disconnected');
//             }
//         }
//         console.log("######################");
//         setTimeout(function () {
//             getStats(peer);
//         }, 5000);
//     });
// }
// function myGetStats(peer, callback) {
//     if (!!navigator.mozGetUserMedia) {
//         peer.getStats(
//             function (res) {
//                 var items = [];
//                 res.forEach(function (result) {
//                     items.push(result);
//                 });
//                 callback(items);
//             },
//             callback
//         );
//     } else {
//         peer.getStats(function (res) {
//             var items = [];
//             res.result().forEach(function (result) {
//                 var item = {};
//                 result.names().forEach(function (name) {
//                     item[name] = result.stat(name);
//                 });
//                 item.id = result.id;
//                 item.type = result.type;
//                 item.timestamp = result.timestamp;
//                 items.push(item);
//             });
//             callback(items);
//         });
//     }
// };
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
