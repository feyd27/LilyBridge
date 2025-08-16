// backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.js');
const logger = require('../services/logger.js');
const crypto = require('crypto');
const router = express.Router();
const { Resend } = require('resend');
const authMiddleware = require('../middleware/authMiddleware.js');

// Generate a random token using crypto for the verification email
function generateVerificationToken() {

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
      loginHistory: [],
      passwordResetHistory: []
    });
    await newUser.save();
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Send verification email using Resend

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'verify@updates.lily-bridge.online',
      to: req.body.username,
      subject: 'Verify your email',
      html: `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
      </head>
      <body style="background: linear-gradient(135deg, #b564c5, #1f5aa8); background-size: cover; background-repeat: no-repeat; margin: 0; padding: 0; background-position: center;">
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
 *     summary: Login an existing user and set authentication cookies
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
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
 *         description: Login successful. Sets accessToken and refreshToken in HttpOnly cookies.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: "accessToken=...; Path=/; HttpOnly, refreshToken=...; Path=/; HttpOnly"
 *             description: Contains the HttpOnly cookies for the access and refresh tokens.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 60d0fe4f5311236168a109ca
 *                     username:
 *                       type: string
 *                       example: user@example.com
 *                     role:
 *                       type: string
 *                       example: user
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
    user.refreshToken = refreshToken;
    user.loginHistory.push({ timestamp: new Date() }); // Record login event
    await user.save();

    // // Send tokens in the response header
    // res.setHeader('Authorization', `Bearer ${accessToken}`);
    // res.setHeader('X-Refresh-Token', refreshToken); // Custom header for refresh token

    // Set tokens into HttpOnly cookies

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Send only over HTTPS
      maxAge: 30 * 60 * 1000 // 30 minutes in ms
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 24 * 60 * 1000 // 2 days in ms
    });

    // res.status(200).json({
    //     message: 'Login successful',
    //     accessToken,
    //     refreshToken,
    // });

    res.status(200).json({
      message: 'Login success',
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });


    //  // Record login event
    //  user.loginHistory.push({ timestamp: new Date() });
    //  await user.save();
  } catch (error) {
    logger.error('Error logging in user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user by clearing authentication cookies
 *     tags: [Auth]
 *     description: |
 *       Logs out the user by clearing the `accessToken` and `refreshToken` HttpOnly cookies.
 *       This endpoint is essential for logging out in a cookie-based authentication system.
 *     responses:
 *       200:
 *         description: User successfully logged out and cookies are cleared.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: "accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT, refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
 *             description: The browser is instructed to clear the authentication cookies.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User logged out successfully
 *       500:
 *         description: Server error
 */
router.post('/logout', async (req, res) => {
  try {
    // Optional but recommended: Invalidate the refresh token in the database
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      // Find the user and nullify their refresh token
      await User.updateOne({ _id: payload.userId }, { $set: { refreshToken: null } });
    }
  } catch (error) {
    // Even if the token is invalid or user not found, proceed with clearing cookies
    logger.error('Error invalidating refresh token during logout:', error.message);
  }

  // Clear the cookies on the client side
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({ message: 'User logged out successfully' });
});
// router.post('/logout', (req, res) => {
//     res.status(200).json({ message: 'User logged out successfully' }); 
// });

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: Check if the user is currently authenticated via cookies
 *     tags: [Auth]
 *     description: |
 *       This is a protected endpoint. It relies on the HttpOnly `accessToken` cookie.
 *       If the cookie is valid (or can be refreshed), it returns the user's authentication status and info.
 *       If not, the authMiddleware will prevent access.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User is authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isAuthenticated:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: User ID from the decoded token.
 *                     role:
 *                       type: string
 *                       description: User's role.
 *       401:
 *         description: Unauthorized. The user is not logged in, and the middleware blocked the request.
 */
router.get('/status', authMiddleware, (req, res) => {
  // If the authMiddleware passes, we know the user is authenticated
  // because it successfully attached the user object to the request.
  if (req.user) {
    res.status(200).json({
      isAuthenticated: true,
      user: {
        userId: req.user.userId,
        role: req.user.role
      }
    });
  } else {
    // This case should technically not be reached if middleware is working correctly,
    // as it would redirect. But as a fallback:
    res.status(401).json({ isAuthenticated: false, message: 'User not authenticated' });
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

