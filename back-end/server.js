// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // Ensure you have this
const connectDB = require('./config/db');
const path = require('path'); // Required for file uploads

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Import Routes
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');

dotenv.config();
connectDB();

const app = express();

app.use(cors()); // Enable CORS for frontend connection
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MOUNT ROUTES (This is the part you might be missing) ---
app.use('/api/users', userRoutes);        // <--- Matches /api/users/register
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);

// Serve Uploaded Images
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Error Handlers (Must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));