const asPromised = (block) => {
  return new Promise((resolve, reject) => {
    block((...results) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.extension.lastError);
      }
      return resolve(...results);
    });
  });
};

entGetInfo = function (item) {
  return asPromised((callback) => {
    if (typeof chrome.enterprise !== 'undefined' ) {
      if ( typeof chrome.enterprise.deviceAttributes !== 'undefined' ) {
        if ( typeof chrome.enterprise.deviceAttributes[item] !== 'undefined' ) {
          return chrome.enterprise.deviceAttributes[item](callback);
        }
      }
    }
    return callback(undefined);
  });
}

getIden = function () {
  return asPromised((callback) => {
    chrome.identity.getProfileUserInfo(callback);
  });
}

function get_data(callback) {
  const data = {};
  const data_needed = ['location', 'assetid', 'directoryid', 'useremail'];
  const mypromises = data_needed.map((item) => {
    if (item === 'useremail') {
      return getIden()
    }
    return entGetInfo(item)
  })
  Promise.all(mypromises).then(function(values) {
    if (values[0]) {
      data.location = values[0].toLowerCase().split(',');
    }
    if (values[1]) {
      data.assetid = values[1];
    }
    if (values[2]) {
      data.directoryid = values[2];
    }
    if (values[3]) {
      data.useremail = values[3].email.toLowerCase();
    }
    callback(data);
  });
}

var block_everything;

function decide_if_blocking(data) {
    console.log(data);
    if (typeof data.location == 'undefined') {
      // unmanaged device
      console.log('couldn\'t get managed device info. Is this device enrolled in your admin console and device location set? Not blocking anything')
      block_everything = false;
      return;
    }
    if (data.location.includes('*')) {
      console.log('Device allows wildcard login, not blocking anything.');
      block_everything = false;
    } else if (data.location.includes(data.useremail)) {
      console.log('Device has this user as allowed to login, not blocking anything.');
      block_everything = false;
    } else {
      console.log('Device does not have this user as allowed, BLOCKING ALL WEBSITES!');
      alert('You are not allowed to use this device. Please log out.');
      block_everything = true;
    }
  }

chrome.runtime.onStartup.addListener(function() {
  console.log('determing blocking status on startup.')
  get_data(decide_if_blocking);
})

chrome.runtime.onInstalled.addListener(function() {
  console.log('determine blocking status on install.')
  get_data(decide_if_blocking);
})

function check_block({frameId, url}) {
  if (block_everything) {
    url = chrome.extension.getURL("blocked.html")
    return { redirectUrl: url };
  } else {
    return;
  }
}

chrome.webRequest.onBeforeRequest.addListener(check_block, {
	urls: ["*://*/*"],
	types: ["main_frame", "sub_frame"]
}, ["blocking"]);
