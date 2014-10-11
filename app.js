var express = require('express');
var bodyParser = require('body-parser');
var settings = require('./config.json');

var app = express();

var router = express.Router();
app.use('/', router);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var twilio = {};

twilio.client = require('twilio')(settings.twilio.sid, settings.twilio.token);

twilio.receiveCall = function(req, res) {
	console.log(req.query);
	res.send("Voice Success");
}
twilio.makeCall = function(req, res) {
	console.log(req.query);
	res.send("Voice Success");
}

twilio.receiveMessage = function(req, res) {
	console.log('messageRecieved');
	//console.log(req.query);

	var callInitiationString = "call";

	var parts = req.query.Body.split(" ");

	if(parts.length == 0){
		console.log("SMS empty")
		//TODO: Send error text message		
	}

	if(!parts[0] == callInitiationString){
		console.log("Initiation string not matched")
		//TODO: Send error text message	
	}

	console.log("Text parts", parts);

	//TODO: Lookup initial user here
	var user = {
		phone: settings.test_number,
		lang: "en_gb"
	}
	//TODO: Send error if not auth


	var intent = {
		from: user.phone,
		from_method: "twilio",
		from_lang: user.lang,
		to: parts[1],
		to_method: "twilio",
		to_lang: parts[2]
	};



	res.send("Message Success");
       
}
twilio.sendMessage = function(to, message) {
	twilio.client.sendMessage({

	    to: to, // Any number Twilio can deliver to
	    from: settings.twilio.number, // A number you bought from Twilio and can use for outbound communication
	    body: message // body of the SMS message

	});
}

router.get('/api/twilio/voice', twilio.receiveCall);
router.get('/api/twilio/message', twilio.receiveMessage);

app.use(express.static(__dirname + '/htdocs'));

var server = app.listen(settings.listen, function() {
    console.log('Listening on port %d', server.address().port);
});
