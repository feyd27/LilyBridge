// backend/routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.js');
const logger = require('../services/logger.js');
const router = express.Router();

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
 *               devices:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of device IDs the user has access to.
 *                 example: ["device1", "device2"]
 *               role:
 *                 type: string
 *                 enum: [reader, user, admin]
 *                 description: Role of the user in the system.
 *                 example: user
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *       400:
 *         description: Username already taken
 *       500:
 *         description: Server error
 */
router.post('/register', async (req, res) => {
    const { username, password, devices, role } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        logger.log('Hashed password: ', hashedPassword);
        const newUser = new User({
            username,
            password: hashedPassword,
            devices,
            role,
        });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
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
        // Find the user by username/email
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Check if the provided password matches the stored password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        // Generate the access token (short-lived)
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
        );

        // Generate the refresh token (long-lived)
        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'Strict',
            path: '/', // Ensure path is '/' for global access
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'Strict',
            path: '/', // Ensure path is '/' for global access
        });


        // Send the tokens to the client
        res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken, // Return refresh token for client-side storage
        });
        logger.log('Access Token:', accessToken);
        logger.log('Refresh Token:', refreshToken);
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// backend/routes/auth.js

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     description: Logs out a user by clearing the refresh token stored in cookies.
 *     responses:
 *       200:
 *         description: User successfully logged out
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
router.post('/logout', (req, res) => {
    try {
        // Clear the refresh token cookie
        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: false,
            sameSite: 'Strict',
            path: '/', // Match the path
        });

        // Clear the access token cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: false,
            sameSite: 'Strict',
            path: '/', // Match the path
        });

        res.status(200).json({ message: 'User logged out successfully' });
    } catch (error) {
        console.error('Error logging out user:', error);
        res.status(500).json({ message: 'Server error' });
    }
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
 *       500:
 *         description: Server error
 */
router.get('/status', (req, res) => {
    try {
        const isAuthenticated = !!req.cookies.accessToken; // Check if accessToken is present in cookies
        res.status(200).json({ isAuthenticated });
    } catch (error) {
        console.error('Error checking authentication status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
