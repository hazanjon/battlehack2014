var express = require('express');
var bodyParser = require('body-parser');
var needle = require('needle');
var http = require('http');
var settings = require('./config.json');

var app = express();

var router = express.Router();
app.use('/', router);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var language_names = {
	english: "en-GB",
	french: "fr-FR",
	german: "de-DE"
}

var connections = [];
var currentRooms =[];

var users = [
	// {
	// 	id: 1,
	// 	name: 'Test',
	// 	phone: settings.test_number,
	// 	lang: settings.test_lang,
	// 	method: "twilio",
	// 	currentRoom: null,
	// 	message_queue: []
	// }
];

var helpers = {};

helpers.findUserByPhone = function(phone) {
	for (var i = 0, len = users.length; i < len; i++) {
		var user = users[i];
			if (user.phone === phone) {
				return user;
		}
	}
	return null;
}
helpers.findUserById = function(id) {
	for (var i = 0, len = users.length; i < len; i++) {
		var user = users[i];
			if (user.id === id) {
				return user;
		}
	}

	return null;
}
helpers.findRoomById = function(room) {
	for (var i = 0, len = currentRooms.length; i < len; i++) {
		var currentRoom = currentRooms[i];
			if (currentRoom.id === room) {
				return currentRoom;
		}
	}
	return null;
}
helpers.langById = function(langs, lang_id) {
	for (var i = 0, len = langs.length; i < len; i++) {
		var lang = langs[i];
			if (lang.lang_id === lang_id) {
				return lang;
		}
	}
	return null;
}

var twilio = {};

twilio.client = require('twilio')(settings.twilio.sid, settings.twilio.token);

twilio.receiveCall = function(req, res) {
	//console.log("Voice Success");
	//console.log(req.query);

	switch(req.query.action){
		case "loop":
			twilio.callLoop(req, res);
		break;
		case "record":
			twilio.callRecording(req, res);
		break;
		case "startrecord":
			twilio.callStartRecording(req, res);
		break;
		default:
			twilio.callInitial(req, res);
		break;
	}
}

twilio.callInitial = function(req, res){

	console.log("Voice Start");
    res.type('text/xml');
    //<Say>Hello there! Talk when you hear the tone, press any key to finish recording</Say>
    res.send('<Response><Say>Hi</Say><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');
}

twilio.callLoop = function(req, res){

	//console.log("Voice Loop");
	res.type('text/xml');

	var response = '<Response>';

	//@TODO: Check if outstanding message to play
	var number = (req.query.From == settings.twilio.number) ? req.query.To : req.query.From;
	//console.log(req.query.From, number);

	var currentuser = helpers.findUserByPhone(number);
	//console.log("User Queue", currentuser.message_queue);

	if(currentuser.message_queue.length){
		for (var i = 0, len = currentuser.message_queue.length; i < len; i++) {
			response += '<Play>'+currentuser.message_queue[i].file+'</Play>';
		}
	}

	currentuser.message_queue = [];
	//console.log('Check for record');
	//Record
	response += '<Gather action="/api/twilio/voice?action=startrecord" method="GET" timeout="1" finishOnKey="#"></Gather>';
	//response += '<Record action="/api/twilio/voice?action=record" timeout="3" method="GET"/>';

	//console.log(response);

	res.send(response+'<Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');

}
twilio.callStartRecording = function(req, res){

	console.log("Start Voice Record");
	res.type('text/xml');
	res.send('<Response><Say>Record now</Say><Record action="/api/twilio/voice?action=record" timeout="5" method="GET"/><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');

}
twilio.callRecording = function(req, res){

	//console.log("Voice Record", req.query);

	var number = (req.query.From == settings.twilio.number) ? req.query.To : req.query.From;
	var currentuser = helpers.findUserByPhone(number);
	//console.log("User", currentuser);

	distribute_message(currentuser, req.query.RecordingUrl, 'speech');
	res.type('text/xml');
	res.send('<Response><Say>Sent</Say><Redirect method="GET">/api/twilio/voice?action=loop</Redirect></Response>');

}

twilio.makeCall = function(req, res) {
	//console.log(req.query);
	//res.send("Voice Success");
}

twilio.receiveMessage = function(req, res) {

	var number = (req.query.From == settings.twilio.number) ? req.query.To : req.query.From;
	var currentuser = helpers.findUserByPhone(number);
	console.log('rece',number, currentuser);

	if(currentuser && currentuser.currentRoom){
		distribute_message(currentuser, req.query.Body, 'text')
	}else{
		twilio.initiateRoomSMS(req, res);
	}

}

twilio.initiateRoomSMS = function(req, res) {
	console.log('messageRecieved');
	//console.log(req.query);
	var parts = req.query.Body.split(" ");
	//@TODO: Auth Twilio

	var callInitiationString = "call";
	var smsInitiationString = "sms";


	if(parts.length == 0){
		console.log("SMS empty")
		//TODO: Send error text message		
	}

	var meth = 'phone';
	if(parts[0].toLowerCase() == callInitiationString){
		meth = 'phone';
	}else if(parts[0].toLowerCase() == smsInitiationString){
		meth = 'sms';
	}else{
		console.log("Initiation string not matched")
		//TODO: Send error text message	
		return;
	}

	var room_id = createRoom();
	console.log("Text parts", parts);
	//expected: Text parts [ 'Call', '0123456789', 'german' ]

	//TODO: Lookup initial user here

	function adduser(search, room_id, method){

		if(search.substr(0,1) == '+')
			search = search.substr(1);

		var url = settings.user_api+'/user/'+search;
		var request = http.get(url, function(response) {
			console.log('status', response.statusCode);
			
			if(response.statusCode !== 200){
				console.log('http error');
			}else{
				var body = '';
				response.on('data', function(chunk) {
					body += chunk;
				});
				response.on('end', function() {
					console.log(body);
			    	body = JSON.parse(body);
					body.id = body._id;
					body.phone = '+'+body.phone;
					body.message_queue = [];
					body.currentRoom = null;
					if(method)
						body.method = method;
			    	console.log(body);
			    	var finduser = helpers.findUserById(body.id);

			    	if(finduser){
			    		finduser = body;
			    	}else{
			    		users.push(body);
			    		var finduser = helpers.findUserById(body.id);
			    	}
					addUserToRoom(room_id, finduser);
			    });
			}
		});
	}

	adduser(req.query.From, room_id, meth);

	var j = 1;
	while(parts[j]){

		adduser(parts[j], room_id);

		j += 1;
	}       
}

twilio.sendSMS = function(to, message) {
	twilio.client.sendMessage({

	    to: to, // Any number Twilio can deliver to
	    from: settings.twilio.number, // A number you bought from Twilio and can use for outbound communication
	    body: message // body of the SMS message

	});
}

twilio.connect = function(user){
	if(user.method == 'phone'){
		twilio.client.makeCall({
		    to: user.phone, // Any number Twilio can call
		    from: settings.twilio.number, // A number you bought from Twilio and can use for outbound communication
		    url: 'http://bh2014.hazan.me/api/twilio/voice' // A URL that produces an XML document (TwiML) which contains instructions for the call

		}, function(err, responseData) {

		    //executed when the call has been initiated.
		    console.log(responseData.from); // outputs "+14506667788"

		});
	}else if(user.method == 'sms'){
		user.message_queue.push({ status: 'success',
			translation: 'Welcome to the Room',
			file: '',
		});

		function checkqueue(user) {
		    setTimeout(function () {
		        
				for (var i = 0, len = user.message_queue.length; i < len; i++) {
					var from = '';
					if(user.message_queue[i].from){
						var name = user.message_queue[i].from.phone;
						if(user.message_queue[i].from.name)
							name = user.message_queue[i].from.name;
						from = 'From '+name+': ';
					}
					var msg = from+user.message_queue[i].translation
					twilio.sendSMS(user.phone, msg);
				}
				user.message_queue = [];
		        checkqueue(user);
		    }, 1000);
		}
		checkqueue(user);

	}
}

connections.phone = twilio;
connections.sms = twilio;

var createUUID = function(){
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	    return v.toString(16);
	});
}

var createRoom = function(){
	var uuid = createUUID();
	var newroom = {
		id: uuid,
		connected: []
	}

	currentRooms.push(newroom);

	console.log('Create Room', uuid);

	return uuid;
}

var addUserToRoom = function(uuid, user, data){

	console.log('Add user to room: ',uuid, user.phone, data)

	var room = helpers.findRoomById(uuid);

	room.connected.push(user.id);

	user.currentRoom = uuid;

	connections[user.method].connect(user);

}

var distribute_message = function(currentuser, message, message_encoding){	

	console.log('Distribution Message:', message, message_encoding);
	var currentroom = helpers.findRoomById(currentuser.currentRoom);
	console.log('Room:', currentroom);

	var langs = [];

	for (var i = 0, len = currentroom.connected.length; i < len; i++) {
		var user = helpers.findUserById(currentroom.connected[i]);

		if(user.id == currentuser.id)
			continue;

		console.log('Room User', user);
		var thislang = helpers.langById(langs, user.lang);
		if(thislang == null){
			var thislang = {
				lang_id: user.lang,
				users: []
			}
			langs.push(thislang);
		}

		thislang.users.push(currentroom.connected[i]);
	}

	console.log('langs', langs);

	//thislang { lang_id: 'de-DE', users: [ [ [Object], [Object] ] ] }

	for (var i = 0, len = langs.length; i < len; i++) {
		var targetlang = langs[i];

		//@TODO: REmove and let the api work
		if(targetlang.lang_id == currentuser.lang){
			//No Translation need, just add the message
			var user = helpers.findUserById(targetlang.users[i]);
			user.message_queue.push({ 
				status: 'success',
				translation: message,
				file: '',
				from: currentuser
			});
			continue;
		}

		console.log(targetlang);
		var url = settings.translation_api.url + '/'+message_encoding+'?api='+settings.translation_api.api_key+'&source='+currentuser.lang+'&target='+targetlang.lang_id+'&text='+message+'&output=speech';

		console.log("Translation URL", url);

		function sendreq(url, targetlang, currentuser){
			console.log('here');
			var request = http.get(url, function(response) {
					console.log('status', response.statusCode);
					
					if(response.statusCode !== 200){
						console.log('http error');
					}else{
						var body = '';
						response.on('data', function(chunk) {
							body += chunk;
						});
						response.on('end', function() {
					    	console.log(body);
					    	body = JSON.parse(body);

					  //   	{
							// status: "success",
							// translation: "i wanna be the very best",
							// file: "http://178.62.47.16/uploads/3dcf7f6ecc1ca33dd662cab6cae76170.mp3",
							// timetaken: 1.0170071125031
							// }

							//@TODO: pick message strat based on comms channel
							if(body.status == "success"){
								body.from = currentuser;
								console.log('List:', targetlang.users)
								for (var k = 0, len = targetlang.users.length; k < len; k++) {
									console.log('Distribute Message:', targetlang.users[k], body)
									var user = helpers.findUserById(targetlang.users[k]);
									user.message_queue.push(body);

									var url = settings.user_api+'/conversation/'+user.currentRoom+'/'+user.id;
									var rq = needle.post(url, {source: body.actual, target: body.translation, from: currentuser.id, to: user.id}, function(error, response) {
										console.log('status', response.statusCode);
										
									});
								}
							}else{

								console.log('Error', body.reason);
							}
						});
					}
			});

		}

		sendreq(url, targetlang, currentuser);
	}
}


router.get('/api/twilio/voice', twilio.receiveCall);
router.post('/api/twilio/voice', twilio.receiveCall);
router.get('/api/twilio/message', twilio.receiveMessage);

app.use(express.static(__dirname + '/htdocs'));

var server = app.listen(settings.listen, function() {
    console.log('Listening on port %d', server.address().port);
});
