require("dotenv").config(); // Load environment variables from .env

const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

const request = mailjet.post("send", { version: "v3.1" }).request({
  Messages: [
    {
      From: {
        Email: process.env.FROM_EMAIL, // Email from .env
        Name: "Your Name or Company Name",
      },
      To: [
        {
          Email: process.env.MY_EMAIL, // Recipient from .env
          Name: "Your Name",
        },
      ],
      Subject: "Hello from Mailjet",
      TextPart: "Greetings from Mailjet and Node.js!",
      HTMLPart:
        "<h3>Greetings from Mailjet and Node.js!</h3><p>This is a test email sent to yourself.</p>",
    },
  ],
});

request
  .then((result) => {
    console.log("Email sent successfully:", result.body);
  })
  .catch((err) => {
    console.log("Error sending email:", err.statusCode);
  });
