// emailService.js

const { Resend } = require('resend'); // Use require instead of import

const resend = new Resend('re_dumexutn_D5UT3QDk1yM7FjdigxD5xqRk');

async function sendEmail() { 
  try {
    await resend.emails.send({
      from: 'Verify@updates.lily-bridge.online',
      to: 'feyd27@gmail.com',
      replyTo: 'support@lily-bridge.online',
      subject: 'Please verify your account at Lily-Bridge.online',
      text: 'NYAH NYAH!',
    });
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

sendEmail(); // Call the function to send the email