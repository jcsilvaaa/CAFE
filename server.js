const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
require('dotenv').config();  // To load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000;  // Use dynamic port from environment or 3000 locally

// Use environment variables for sensitive info

const mongoDBUri = "mongodb+srv://jeansilva:DLSU1234!@tastecheck.hhcdgvj.mongodb.net/webcafe?retryWrites=true&w=majority";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/uploads", express.static("uploads")); 
app.use("/images", express.static(path.join(__dirname, "Public", "images")));
app.use(express.static(path.join(__dirname, 'Public')));

// Serve homepage.html for the root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "Homepage.html"));
});

// MongoDB Connection
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    firstName: String,  
    lastName: String,   
    description: String,
    website: String,    
    facebook: String,   
    twitter: String,  
    avatar: String
});

const User = mongoose.model("User", userSchema);

// Review Schema
const reviewSchema = new mongoose.Schema({
    userId: String,
    username: String,
    branch: String,
    rating: Number,
    text: String,
    date: { type: Date, default: Date.now }
});
const Review = mongoose.model("Review", reviewSchema);

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: "./uploads",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const upload = multer({ storage });

// Register Route with Password Hashing
app.post("/register", upload.single("avatar"), async (req, res) => {
    try {
        const { username, email, password, description } = req.body;
        const avatar = req.file ? "/uploads/" + req.file.filename : null;

        // Check if the email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "❌ Email already registered." });
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save the new user with the hashed password
        const newUser = new User({ username, email, password: hashedPassword, description, avatar });
        await newUser.save();

        res.json({ message: "✅ User registered successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Error registering user." });
    }
});

// Login Route with Password Comparison
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "❌ Invalid email or password." });
        }

        // Compare the provided password with the hashed password in the database
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "❌ Invalid email or password." });
        }

        res.json({
            message: "✅ Login successful!",
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                description: user.description,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Error logging in." });
    }
});

// Update Profile Route
app.put("/update-profile/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const updatedFields = {
            email: req.body.email,
            username: req.body.username,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            description: req.body.description,
            website: req.body.website,
            facebook: req.body.facebook,
            twitter: req.body.twitter
        };

        const updatedUser = await User.findByIdAndUpdate(userId, updatedFields, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "✅ Profile updated successfully!", user: updatedUser });
    } catch (error) {
        console.error("❌ Error updating profile:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Update Avatar Route
app.put("/update-avatar/:id", upload.single("avatar"), async (req, res) => {
    try {
        const userId = req.params.id;
        if (!req.file) {
            return res.status(400).json({ message: "❌ No file uploaded." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { avatar: "/uploads/" + req.file.filename },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "❌ User not found." });
        }

        res.json({ message: "✅ Profile picture updated!", avatar: updatedUser.avatar });
    } catch (err) {
        console.error("❌ Error updating profile picture:", err);
        res.status(500).json({ message: "Error updating profile picture." });
    }
});

// Fetch Reviews by Branch
app.get("/reviews/:branch", async (req, res) => {
    try {
        const { branch } = req.params;
        const reviews = await Review.find({ branch }).sort({ date: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reviews." });
    }
});

// Post Review with Branch Handling
app.post("/reviews/:branch", async (req, res) => {
    try {
        const { branch } = req.params; 
        const { userId, username, rating, text } = req.body;

        const newReview = new Review({ userId, username, branch, rating, text });
        await newReview.save();

        res.json({ message: "✅ Review added!", review: newReview });
    } catch (err) {
        res.status(500).json({ message: "Error submitting review." });
    }
});

// Edit Review by Branch
app.put("/reviews/:branch/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { text, rating } = req.body;

        const updatedReview = await Review.findByIdAndUpdate(id, { text, rating }, { new: true });

        if (!updatedReview) {
            return res.status(404).json({ message: "❌ Review not found." });
        }

        res.json({ message: "✅ Review updated!", review: updatedReview });
    } catch (err) {
        res.status(500).json({ message: "Error updating review." });
    }
});

// Delete Review by Branch
app.delete("/reviews/:branch/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const deletedReview = await Review.findByIdAndDelete(id);

        if (!deletedReview) {
            return res.status(404).json({ message: "❌ Review not found." });
        }

        res.json({ message: "✅ Review deleted!" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting review." });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
