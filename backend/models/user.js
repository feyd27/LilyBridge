const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true, // Trims any extra whitespace
        lowercase: true, // Stores email in lowercase for consistency
    },
    password: {
        type: String,
        required: true,
    },
    devices: {
        type: [String], // Array of strings for device IDs or names
        default: [],
    },
    role: {
        type: String,
        enum: ['reader', 'user', 'admin'],
        default: 'user', // Default role
        required: true,
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
