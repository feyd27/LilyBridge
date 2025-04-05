// backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.js');
const logger = require('../services/logger.js');
const crypto = require('crypto');
const router = express.Router();
const { Resend } = require('resend');
function generateVerificationToken() {
    // Generate a random token using crypto
    return crypto.randomBytes(32).toString('hex'); 
  }

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username or email for the user.
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 description: User password.
 *                 example: password123
 *               mqttBroker:  # Add mqttBroker to the Swagger docs
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                     description: Address of the MQTT broker
 *                     example: "mqtt://broker.example.com"
 *                   username:
 *                     type: string
 *                     description: Username for the MQTT broker
 *                     example: "mqttuser"
 *                   password:
 *                     type: string
 *                     description: Password for the MQTT broker
 *                     example: "mqttpassword"
 *                   isPrivate:
 *                     type: boolean
 *                     description: Whether the MQTT broker is private
 *                     example: true
 *               role:
 *                 type: string
 *                 enum: [reader, user, admin]
 *                 description: Role of the user in the system.
 *                 example: user
 *     responses:
 *       201:
 *         description: User registered successfully. A verification email has been sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully. A verification email has been sent to user@example.com.
 *       400:
 *         description: Username already taken or invalid input.
 *       500:
 *         description: Server error during registration.
 */
router.post('/register', async (req, res) => {
    const { username, password, mqttBroker, role } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateVerificationToken(); 
        const newUser = new User({ 
          username, 
          password: hashedPassword, 
          mqttBroker, 
          role,
          verificationToken: verificationToken,
          hasCompletedSetup: false, 
          loginHistory:[],        
          passwordResetHistory:[] 
        });
        await newUser.save();
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

         // Send verification email using Resend

         const resend = new Resend('re_dumexutn_D5UT3QDk1yM7FjdigxD5xqRk');

    await resend.emails.send({
        from: 'verify@updates.lily-bridge.online', // Replace with your verified sender email
        to: req.body.username, // Assuming username is the email
        subject: 'Verify your email',
        html: `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
      </head>
      <body style="background-image: url('https://i.ibb.co/ymfL8XKf/app-header.png'); background-size: cover; background-repeat: no-repeat; margin: 0; padding: 0; background-position: center;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1>Welcome to Lily-Bridge!</h1>
                    <p>Please verify your email address by clicking the button below:</p>
                    <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    <p>If you did not create an account, you can ignore this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`
      });

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        logger.error('Error registering user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login an existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email of the user.
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 description: User's password.
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful and returns access and refresh tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 accessToken:
 *                   type: string
 *                   description: Short-lived JWT token for accessing protected routes.
 *                 refreshToken:
 *                   type: string
 *                   description: Long-lived JWT token for refreshing access tokens.
 *       400:
 *         description: Invalid username or password
 *       500:
 *         description: Server error
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Generate Access Token and Refresh Token
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        // Send tokens in the response header
        res.setHeader('Authorization', `Bearer ${accessToken}`);
        res.setHeader('X-Refresh-Token', refreshToken); // Custom header for refresh token

        res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken,
        });
        logger.log('Access Token:', accessToken);
        logger.log('Refresh Token:', refreshToken);
    } catch (error) {
        logger.error('Error logging in user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     description: Logout endpoint is not required as token is stored in local storage.
 *     responses:
 *       200:
 *         description: User successfully logged out (no action needed on backend)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User logged out successfully
 */
router.post('/logout', (req, res) => {
    res.status(200).json({ message: 'User logged out successfully' }); 
});

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Check the authentication status of the user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Authentication status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isAuthenticated:
 *                   type: boolean
 *                   description: Whether the user is authenticated
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties: 
 *                     userId:
 *                       type: string
 *                       description: User ID from the decoded token
 *                     role:
 *                       type: string
 *                       description: User's role
 *       401:
 *         description: Unauthorized - Token is missing or invalid
 */
router.get('/status', (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    try {
        if (!token) {
            return res.status(401).json({ isAuthenticated: false, message: 'Token is missing' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.status(200).json({ isAuthenticated: true, user: { userId: decoded.userId, role: decoded.role } });
    } catch (error) {
        res.status(401).json({ isAuthenticated: false, message: 'Invalid token' });
    }
});


// backend/routes/authRoutes.js
/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify user email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Verification token from the email link
 *                 example: "your_verification_token" 
 *     responses:
 *       200:
 *         description: Account verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Account verified successfully!"
 *       400:
 *         description: Invalid verification token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid verification token."
 *       500:
 *         description: Server error during verification
 */
router.post('/verify-email', async (req, res) => {
    const { token } = req.body;
  
    try {
      const user = await User.findOne({ verificationToken: token });
      if (!user) {
        return res.status(400).json({ message: 'Invalid verification token.' });
      }
  
      user.isVerified = true;
      user.verificationToken = undefined; // Clear the token
      await user.save();
  
      res.json({ message: 'Account verified successfully!' });
    } catch (error) {
      logger.error('Error verifying account:', error);
      res.status(500).json({ message: 'Server error during verification.' });
    }
  });

module.exports = router;

