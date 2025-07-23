require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const CREDENTIALS = require('./sheaccess-lobq-4edd8caccc54.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

// Dialogflow client setup
const sessionClient = new dialogflow.SessionsClient({
	credentials: {
		private_key: process.env.DIALOGFLOW_PRIVATE_KEY.replace(/\\n/g, '\n'),
		client_email: process.env.DIALOGFLOW_CLIENT_EMAIL,
	},
	projectId: process.env.PROJECT_ID,
});

app.get('/', (req, res) => {
	res.send('SheAccess+ Webhook Running');
});

// Handle WhatsApp webhook
app.post('/whatsapp', async (req, res) => {
	const from = req.body.From;
	const to = req.body.To;
	const body = req.body.Body;

	const projectId = await sessionClient.getProjectId();
	const sessionPath = sessionClient.projectAgentSessionPath(projectId, from);

	const response = await sessionClient.detectIntent({
		session: sessionPath,
		queryInput: {
			text: {
				text: body,
				languageCode: 'en-US',
			}
		}
	});

	const result = response[0].queryResult;

	if (result.action === 'emi.due-date') {
		let dueDate = new Date();
		dueDate.setDate(dueDate.getDate() + 5);
		let dueAmount = "$200";

		await twilioClient.messages.create({
			from: to,
			to: from,
			body: `Your next EMI of ${dueAmount} is due on ${dueDate.toDateString()}.`
		});
		res.status(200).end();
		return;
	}

	const messages = result.fulfillmentMessages;
	for (const message of messages) {
		if (message.text) {
			await twilioClient.messages.create({
				from: to,
				to: from,
				body: message.text.text[0],
			});
		}

		if (message.payload) {
			let url = message.payload.fields.media_url?.stringValue || '';
			let text = message.payload.fields.text?.stringValue || '';

			await twilioClient.messages.create({
				from: to,
				to: from,
				body: text,
				mediaUrl: url,
			});
		}
	}

	res.status(200).end();
});

// Optional basic help test handler
app.post('/webhook', (req, res) => {
	const twiml = new MessagingResponse();
	const incomingMsg = req.body.Body?.toLowerCase();

	if (incomingMsg.includes('help')) {
		twiml.message('🆘 How can I assist you? Type EMERGENCY to send alerts.');
	} else if (incomingMsg.includes('emergency')) {
		twiml.message('🚨 Emergency detected! Notifying contacts...');
	} else {
		twiml.message("👋 Welcome to SheAccess+. Type 'help' to begin.");
	}

	res.writeHead(200, { 'Content-Type': 'text/xml' });
	res.end(twiml.toString());
});

// Start server
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
