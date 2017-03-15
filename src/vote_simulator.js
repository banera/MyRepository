for(var i=0;i<1000000;i++) {
    //assume we can have 1M distinct users
    var userId = Math.floor((Math.random()*1000000) + 1);
    var username = "user-" + userId;
    var candidateIndex = Math.floor(Math.random()*10);

    self.postMessage({'user': username, 'candidate': candidateIndex});
}

self.postMessage('stop');