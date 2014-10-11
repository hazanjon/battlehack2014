var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var settings = require('./config.json');

var app = express();

var router = express.Router();
app.use('/', router);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var currentCalls =[
	{
		id: 3,
		connected: [1]
	}
];

var users = [
	{
		id: 1,
		name: 'Test',
		phone: settings.test_number,
		lang: settings.test_lang,
		currentCall: 3
	}
];

var helpers = {};

helpers.findUserByPhone = function(phone) {
	for (var i = 0, len = users.length; i < len; i++) {
		var user = users[i];
			if (user.email === email) {
				return user;
		}
	}
	return null;
}

var twilio = {};

twilio.client = require('twilio')(settings.twilio.sid, settings.twilio.token);

twilio.receiveCall = function(req, res) {
	console.log("Voice Success");
	console.log(req.query);

	switch(req.query.action){
		case "loop":
			twilio.callLoop(req, res);
		break;
		case "record":
			twilio.callRecording(req, res);
		break;
		default:
			twilio.callInitial(req, res);
		break;
	}
}

twilio.callInitial = function(req, res){

	console.log("Voice Start");
    res.type('text/xml');
    res.send('<Response><Say>Hello there! Talk when you hear the tone, press any key to finish recording</Say><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');
}

twilio.callLoop = function(req, res){

	console.log("Voice Loop");
	res.type('text/xml');

	//@TODO: Check if outstanding message to play
	//Record
	res.send('<Response><Record action="/api/twilio/voice?action=record" timeout="1" method="GET"/><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');

}
twilio.callRecording = function(req, res){

	console.log("Voice Record", req.query.RecordingUrl);

	var url = settings.translation_api.url + '/speech?api='+settings.translation_api.api_key+'&source=en-GB&target=de-DE&location=http://api.twilio.com/2010-04-01/Accounts/AC6ecab69649ef42b88af8e3a992e9f325/Recordings/RE7967b47aa851d42a6b7ddae0deccc54d&output=speech';

	console.log("Translation URL", url);
	var request = http.get(url, function(response) {
			console.log('status', response.statusCode);
			
			if(response.statusCode !== 200){
				console.log('http error');
			}else{
				var body = '';
				response.on('data', function(chunk) {
			    	console.log(chunk);
					body += chunk;
				});
				response.on('end', function() {
			    	console.log(body);
			    	body = JSON.parse(body);
					res.type('text/xml');
					res.send('<Response><Play>'+body.file+'</Play><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');
				});
			}
	});


}

twilio.makeCall = function(req, res) {
	console.log(req.query);
	res.send("Voice Success");
}

twilio.receiveMessage = function(req, res) {
	console.log('messageRecieved');
	//console.log(req.query);
	//@TODO: Auth Twilio

	if(req.query.test == 1){
		req.query.Body = "call 0123456789 german";
	}

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
	//expected: Text parts [ 'Call', '0123456789', 'german' ]

	//TODO: Lookup initial user here
	var user = {
		phone: settings.test_number,
		lang: settings.test_lang
	}
	//TODO: Send error if not auth


	var intent = {
		action: "intiate_comms",
		from: user.phone,
		from_method: "twilio",
		from_lang: user.lang,
		to: parts[1],
		to_method: "twilio",
		to_lang: parts[2]
	};

	intentHandler.process(intent);

	res.send("Message Success");
       
}
twilio.sendMessage = function(to, message) {
	twilio.client.sendMessage({

	    to: to, // Any number Twilio can deliver to
	    from: settings.twilio.number, // A number you bought from Twilio and can use for outbound communication
	    body: message // body of the SMS message

	});
}

var intentHandler = {};

intentHandler.process = function(intent){
	switch(intent.action){
		case "intiate_comms":
			
		break;
		case "terminate_comms":
			
		break;
		case "distribute_message":
			
		break;
	}
}

var distribute_message = function(){

}

var test = function(req, res) {
	var url = "http://178.62.47.16/speech?api=1234&source=en-GB&target=de-DE&location=http://api.twilio.com/2010-04-01/Accounts/AC6ecab69649ef42b88af8e3a992e9f325/Recordings/RE7967b47aa851d42a6b7ddae0deccc54d&output=speech";
	var request = http.get(url, function(response) {
			console.log('status', response.statusCode);
			
			if(response.statusCode !== 200){
				console.log('http error');
			}else{
				var body = '';
				response.on('data', function(chunk) {
			    	console.log(chunk);
					body += chunk;
				});
				response.on('end', function() {
			    	console.log(body);
			    	body = JSON.parse(body);
					res.type('text/xml');
					res.send('<Response><Play>'+body.file+'</Play><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');
				});
			}
	});
}


router.get('/api/twilio/voice', twilio.receiveCall);
router.get('/api/twilio/message', twilio.receiveMessage);
router.get('/test', test);

app.use(express.static(__dirname + '/htdocs'));

var server = app.listen(settings.listen, function() {
    console.log('Listening on port %d', server.address().port);
});
