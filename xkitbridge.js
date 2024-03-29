//////
//
//  This is sample code to bridge the Thinxtra/Sigfox data to the Oracle IoT Cloud.
//
//////

// Read Environment Parameters from Oracle Application Container Cloud Service (ACCS)
// If no env variables are there, use default values.
var port = Number(process.env.PORT || 9905);
var iotHost = process.env.IOTHOST || "oc-129-150-113-134.compute.oraclecloud.com";
var iotPort = process.env.IOTPORT || "32770";
var IoTuser = process.env.IOTUSER || "IotUser";
var IoTpass = process.env.IOTPASS || "jdR94936";
var IoTdevicePassword = process.env.IOTDEVPASS || "jdR94936";

//
// Setup express
//
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cors = require('cors');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cors());

//
// Setup IoT services
//
var util = require('util');
var Client = require('node-rest-client').Client;
var IoTServer = require('jsclient/iot');

console.log("Setting up IoT Server to"+'http://'+iotHost+':'+iotPort);
var iot = new IoTServer('http://'+iotHost+':'+iotPort);
iot.setPrincipal(IoTuser, IoTpass);

var options_auth = { user: IoTuser, password: IoTpass };
var client = new Client(options_auth);
client.on('error', function(err) {
  console.log("Send Error: "+err);
});

//
// Function to send data based on the device and data URN.
//
// This method will register and activate the device automatically if needed.
//
function sendData(deviceId, model, deviceUrn, dataUrn, payload) {
    console.log("Trying to get device"+deviceId)

    var args = { headers: { "Accept-Type": "application/json" } }
    console.log("Searching for device in the IoT Cloud: "+"http://"+iotHost+":"+iotPort+"/iot/api/v2/devices?limit=100000");

    var foundDevice = null;

    // Get current devices in the IoT system.
    var req = client.get("http://"+iotHost+":"+iotPort+"/iot/api/v2/devices?limit=100000", args, function(data,response) {
      var found=false;

      // Look for this particular device based on the serial number.
      for(var i = 0; i < data.items.length; i++) {
        if(data.items[i].serialNumber === deviceId) {
          found=true;
          iot.getDevice(data.items[i].id, IoTdevicePassword).then(function(device) {
            console.log("Device FOUND in IoT Cloud.");
            // Device has been found, send data to device instance.
            device.sendDataMessages(dataUrn, payload).then(function(response) {
              console.log("Sent msg to iot: ");
            }).catch(function(error) {
              console.log("Error");
              console.log(error.statusCode || error);
              console.log("error"+util.inspect(error.body,false,null));
            });
          });
        }
      }

      // If the device has not been found, register it.
      if(!found) {
        console.log("Device not found in IoT cloud.  Registering new device.");
        var metadata = {
          manufacturer: "Sigfox",
          description: "Sigfox / Thinxtra - "+deviceId,
          modelNumber: model,
          serialNumber: deviceId,
        };
  
        var result = iot.createDevice(IoTdevicePassword, 'Sigfox / Thinxtra - '+deviceId, 'DIRECTLY_CONNECTED_DEVICE', metadata).then(function(device) {
          console.log('Device', device.getID(), 'created, now activating...');
          device.activate(deviceUrn); // Activate specific URN
          // Device now created and activated.  Send data to device instance.
          device.sendDataMessages(dataUrn, req.body).then(function(response) {
            console.log("Sent msg to iot: ");
          }).catch(function(error) {
            console.log("Error");
            console.log(error.statusCode || error);
          });
        });
      }
    });
}

//
// Send data for the development XKit device
//
app.post('/sigfox/thinxtra/xkit/senddata', function (req, res) {
    console.log("Sending xkit data.");
    var payload = req.body;

    // Modify the data based on Sigfox spec:
    payload.temperature = payload.temperature/100;
    payload.pressure = payload.pressure*3;
    payload.photo = payload.photo/1000;
    payload.x_accelerator = payload.x_accelerator/250;
    payload.y_accelerator = payload.y_accelerator/250;
    payload.z_accelerator = payload.z_accelerator/250;

    var deviceId = req.body.device
    sendData(deviceId, "XKit", "urn:thinxtra:sigfox:device:xkit", "urn:thinxtra:sigfox:device:xkit:data", payload);

    // Respond async.  No need for transactional.
    res.send(JSON.stringify({ result: "Success"}));
    res.end();
});

//
// Send data for the Oyster device
//
app.post('/sigfox/thinxtra/oyster/senddata', function (req, res) {
    console.log("Sending oyster data.");
    var payload = req.body;
    payload.lat = payload.lat/10000000;
    payload.lon = payload.lon/10000000;
    payload.heading = payload.heading*2; // Convert to degrees.

    var deviceId = req.body.device
    sendData(deviceId, "Oyster", "urn:thinxtra:sigfox:device:oyster", "urn:thinxtra:sigfox:device:oyster:data", payload);

    // Respond async.  No need for transactional.
    res.send(JSON.stringify({ result: "Success"}));
    res.end();
});

//////////////////////////////////////////////////////////
// Start listener
//////////////////////////////////////////////////////////
var server = app.listen(port, function () {
  console.log("App listening on port %s", port);
  console.log("Listening for calls to: '/sigfox/thinxtra/xkit/senddata'");
  console.log("Listening for calls to: '/sigfox/thinxtra/oyster/senddata'");
})
